import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const checker = path.join(projectRoot, 'tools', 'check_vendored_dependencies.js')

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tad-vendored-dependency-'))
  fs.copyFileSync(path.join(projectRoot, 'package-lock.json'), path.join(root, 'package-lock.json'))
  fs.mkdirSync(path.join(root, 'vendor'), { recursive: true })
  fs.copyFileSync(
    path.join(projectRoot, 'vendor', 'image-size-2.0.3-tad.1.tgz'),
    path.join(root, 'vendor', 'image-size-2.0.3-tad.1.tgz'),
  )
  fs.cpSync(path.join(projectRoot, 'vendor', 'image-size-fork'), path.join(root, 'vendor', 'image-size-fork'), { recursive: true })
  return root
}

function run(root, env = process.env) {
  return spawnSync(process.execPath, [checker, '--root', root], { encoding: 'utf8', env, windowsHide: true })
}

test('reproduces the integrity-pinned image-size fork from versionable source', () => {
  const result = run(projectRoot)
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.match(result.stdout, /PASS/)
})

test('fails closed when a compiled fork file is absent', () => {
  const root = fixture()
  try {
    fs.rmSync(path.join(root, 'vendor', 'image-size-fork', 'dist', 'index.js'))
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /MISSING_VENDORED_SOURCE/)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('fails closed when Git would omit compiled fork bytes from a clean checkout', () => {
  const root = fixture()
  try {
    fs.writeFileSync(path.join(root, '.gitignore'), 'dist/\n', 'utf8')
    const init = spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8', windowsHide: true })
    assert.equal(init.status, 0, init.stderr)
    const result = run(root)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /VENDORED_SOURCE_IGNORED/)
  } finally { fs.rmSync(root, { recursive: true, force: true }) }
})

test('fails closed when Git metadata exists but Git visibility cannot be checked', () => {
  const root = fixture()
  const emptyPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tad-no-git-path-'))
  try {
    const init = spawnSync('git', ['init', '--quiet', root], { encoding: 'utf8', windowsHide: true })
    assert.equal(init.status, 0, init.stderr)
    const env = { ...process.env }
    for (const key of Object.keys(env)) {
      if (key.toLowerCase() === 'path') delete env[key]
    }
    env.PATH = emptyPath
    const result = run(root, env)
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`)
    assert.match(result.stderr, /GIT_VISIBILITY_CHECK_FAILED/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(emptyPath, { recursive: true, force: true })
  }
})
