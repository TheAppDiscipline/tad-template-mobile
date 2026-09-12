import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const linkingDecision = 'Review GHSA-vcc3-ghjq-m6fr before enabling navigation deep links; revise this guard only after an explicit security review.'

function safeVersion(name, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version ?? '')) return false
  const [major, minor, patch] = version.split('.').map(Number)
  if (name === 'fast-uri') return major === 3 && (minor > 1 || (minor === 1 && patch >= 6))
  if (name === 'smol-toml') return major > 1 || (major === 1 && minor >= 8)
  return major === 0 && ((minor === 8 && patch >= 15) || (minor === 9 && patch >= 12))
}

function inspectDependencies(manifest, lock, installed) {
  const issues = []
  const entries = Object.entries(lock.packages ?? {})
  for (const name of ['fast-uri', '@xmldom/xmldom', 'smol-toml']) {
    const suffix = `node_modules/${name}`
    const nodes = entries.filter(([location]) => location === suffix || location.endsWith(`/${suffix}`))
    if (name === 'fast-uri') {
      if (nodes.length !== 1 || nodes[0][0] !== suffix) issues.push('FAST_URI_RESOLUTION')
      if (manifest.overrides?.['fast-uri'] !== '$fast-uri') issues.push('FAST_URI_OVERRIDE')
      if (manifest.devDependencies?.['fast-uri'] !== nodes[0]?.[1].version) issues.push('FAST_URI_PIN')
    } else if (name === '@xmldom/xmldom') {
      for (const branch of ['0.8.', '0.9.']) {
        if (!nodes.some(([, node]) => node.version?.startsWith(branch))) issues.push(`XML_BRANCH_MISSING:${branch}`)
      }
    } else {
      if (nodes.length !== 1 || nodes[0][0] !== suffix) issues.push('SMOL_TOML_RESOLUTION')
      if (manifest.overrides?.['smol-toml'] !== '$smol-toml') issues.push('SMOL_TOML_OVERRIDE')
      if (manifest.devDependencies?.['smol-toml'] !== nodes[0]?.[1].version) issues.push('SMOL_TOML_PIN')
    }
    for (const [location, node] of nodes) {
      if (!safeVersion(name, node.version)) issues.push(`VULNERABLE_VERSION:${location}`)
      if (installed[location] !== node.version) issues.push(`INSTALLED_VERSION_MISMATCH:${location}`)
    }
  }
  return issues
}

function inspectNavigation(source) {
  const file = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const issues = []
  if (file.parseDiagnostics.length) return ['NAVIGATION_PARSE_ERROR']
  const containers = new Set()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || statement.moduleSpecifier.text !== '@react-navigation/native') continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamespaceImport(bindings)) containers.add(`${bindings.name.text}.NavigationContainer`)
    if (bindings && ts.isNamedImports(bindings)) {
      for (const binding of bindings.elements) {
        if ((binding.propertyName ?? binding.name).text === 'NavigationContainer') containers.add(binding.name.text)
      }
    }
  }
  let count = 0
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && containers.has(node.tagName.getText(file))) {
      count += 1
      for (const attribute of node.attributes.properties) {
        if (ts.isJsxSpreadAttribute(attribute)) {
          issues.push('NAVIGATION_PROPS_SPREAD')
        } else if (attribute.name.getText(file) === 'linking') {
          const expression = attribute.initializer && ts.isJsxExpression(attribute.initializer)
            ? attribute.initializer.expression : undefined
          const properties = expression && ts.isObjectLiteralExpression(expression) ? expression.properties : []
          const enabled = properties.filter((property) => (
            ts.isPropertyAssignment(property) && (property.name.text ?? property.name.getText(file)) === 'enabled'
          ))
          if (properties.some((property) => !ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name)) || enabled.length !== 1 || enabled[0].initializer.kind !== ts.SyntaxKind.FalseKeyword) {
            issues.push('NAVIGATION_LINKING_REVIEW_REQUIRED')
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  if (count !== 1) issues.push('NAVIGATION_CONTAINER_REVIEW_REQUIRED')
  return issues
}

function dependencyFixture() {
  const fast = 'node_modules/fast-uri'
  const toml = 'node_modules/smol-toml'
  const xml08 = 'node_modules/@xmldom/xmldom'
  const xml09 = 'node_modules/plist/node_modules/@xmldom/xmldom'
  const installed = { [fast]: '3.1.6', [toml]: '1.8.0', [xml08]: '0.8.15', [xml09]: '0.9.12' }
  return {
    manifest: {
      devDependencies: { 'fast-uri': '3.1.6', 'smol-toml': '1.8.0' },
      overrides: { 'fast-uri': '$fast-uri', 'smol-toml': '$smol-toml' },
    },
    lock: { packages: Object.fromEntries(Object.entries(installed).map(([location, version]) => [location, { version }])) },
    installed,
  }
}

test('installed Mobile dependency branches meet the reviewed security floors', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'))
  const installed = {}
  for (const location of Object.keys(lock.packages)) {
    if (!/(^|\/)node_modules\/(fast-uri|smol-toml|@xmldom\/xmldom)$/.test(location)) continue
    const target = path.resolve(root, location, 'package.json')
    assert.ok(target.startsWith(`${root}${path.sep}`), 'dependency path must stay in the project')
    installed[location] = JSON.parse(fs.readFileSync(target, 'utf8')).version
  }
  assert.deepEqual(inspectDependencies(manifest, lock, installed), [])
})

test('dependency guard accepts the coherent patched tree', () => {
  const { manifest, lock, installed } = dependencyFixture()
  assert.deepEqual(inspectDependencies(manifest, lock, installed), [])
})

for (const [location, version] of [
  ['node_modules/fast-uri', '3.1.5'],
  ['node_modules/smol-toml', '1.7.0'],
  ['node_modules/@xmldom/xmldom', '0.8.14'],
  ['node_modules/plist/node_modules/@xmldom/xmldom', '0.9.11'],
]) {
  test(`dependency guard rejects vulnerable ${location}@${version}`, () => {
    const { manifest, lock, installed } = dependencyFixture()
    lock.packages[location].version = version
    installed[location] = version
    assert.ok(inspectDependencies(manifest, lock, installed).includes(`VULNERABLE_VERSION:${location}`))
  })
}

for (const [location, branch] of [
  ['node_modules/@xmldom/xmldom', '0.8.'],
  ['node_modules/plist/node_modules/@xmldom/xmldom', '0.9.'],
]) {
  test(`dependency guard requires XML branch ${branch}`, () => {
    const { manifest, lock, installed } = dependencyFixture()
    delete lock.packages[location]
    delete installed[location]
    assert.ok(inspectDependencies(manifest, lock, installed).includes(`XML_BRANCH_MISSING:${branch}`))
  })
}

test('dependency guard rejects installed drift, duplicate resolutions and divergent overrides', () => {
  const { manifest, lock, installed } = dependencyFixture()
  installed['node_modules/fast-uri'] = '3.1.5'
  lock.packages['node_modules/ajv/node_modules/fast-uri'] = { version: '3.1.6' }
  lock.packages['node_modules/markdownlint-cli2/node_modules/smol-toml'] = { version: '1.8.0' }
  manifest.overrides['fast-uri'] = '3.1.5'
  manifest.overrides['smol-toml'] = '1.7.0'
  const issues = inspectDependencies(manifest, lock, installed)
  assert.ok(issues.includes('FAST_URI_RESOLUTION'))
  assert.ok(issues.includes('FAST_URI_OVERRIDE'))
  assert.ok(issues.includes('SMOL_TOML_RESOLUTION'))
  assert.ok(issues.includes('SMOL_TOML_OVERRIDE'))
  assert.ok(issues.includes('INSTALLED_VERSION_MISMATCH:node_modules/fast-uri'))
})

test('template navigation keeps the conditional decoder acceptance valid', () => {
  assert.deepEqual(inspectNavigation(fs.readFileSync(path.join(root, 'App.tsx'), 'utf8')), [], linkingDecision)
})

const navigationImport = "import { NavigationContainer } from '@react-navigation/native';"
for (const attributes of ['', 'linking={{ enabled: false }}']) {
  test(`navigation guard permits disabled linking: ${attributes || 'omitted'}`, () => {
    assert.deepEqual(inspectNavigation(`${navigationImport}<NavigationContainer ${attributes} />`), [])
  })
}

for (const attributes of [
  'linking',
  'linking={{ enabled: true }}',
  'linking={{ prefixes: ["app://"] }}',
  'linking={options}',
  '{...props}',
  'linking={{ enabled: false, ...options }}',
  'linking={{ enabled: false, [key]: true }}',
  'linking={{ enabled: false, get enabled() { return true } }}',
]) {
  test(`navigation guard rejects unreviewed linking: ${attributes}`, () => {
    assert.notDeepEqual(inspectNavigation(`${navigationImport}<NavigationContainer ${attributes} />`), [], linkingDecision)
  })
}

test('navigation guard follows renamed and namespace imports', () => {
  for (const source of [
    "import { NavigationContainer as Nav } from '@react-navigation/native'; <Nav linking={{ enabled: true }} />",
    "import * as Navigation from '@react-navigation/native'; <Navigation.NavigationContainer linking={{ enabled: true }} />",
  ]) assert.ok(inspectNavigation(source).includes('NAVIGATION_LINKING_REVIEW_REQUIRED'), linkingDecision)
})

test('navigation guard refuses missing containers and malformed source', () => {
  assert.ok(inspectNavigation('export default function App() { return null }').includes('NAVIGATION_CONTAINER_REVIEW_REQUIRED'))
  assert.ok(inspectNavigation(`${navigationImport}<NavigationContainer`).includes('NAVIGATION_PARSE_ERROR'))
})

test('navigation guard ignores inert linking text in strings and comments', () => {
  const source = `${navigationImport}const text = '<NavigationContainer linking />'; /* linking={{ enabled: true }} */ <NavigationContainer />`
  assert.deepEqual(inspectNavigation(source), [])
})

for (const name of ['@expo/plist', 'plist']) {
  test(`${name} preserves plist round trips and recoverable end-tag handling`, () => {
    const module = require(name)
    const plist = module.default ?? module
    const expected = { CFBundleName: 'Template', Enabled: true, Items: ['one', 'two'] }
    const xml = plist.build(expected)
    const parsed = plist.parse(xml)
    assert.deepEqual({ ...parsed }, expected)
    const malformed = '<plist version="1.0"><dict><key>name</key><string>value</string\ntrailing></dict></plist>'
    assert.deepEqual({ ...plist.parse(malformed) }, { name: 'value' })
  })
}
