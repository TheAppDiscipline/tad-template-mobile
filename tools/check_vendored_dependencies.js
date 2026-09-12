#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const args = parseArgs(process.argv.slice(2))
const root = path.resolve(args.root ?? process.cwd())
const findings = inspectVendoredImageSize(root)

if (findings.length) {
  console.error(`Vendored dependency check: FAIL; findings=${findings.length}`)
  for (const finding of findings) console.error(`  ${finding.code}: ${finding.message}`)
  process.exitCode = 1
} else {
  const tarball = path.join(root, 'vendor', 'image-size-2.0.3-tad.1.tgz')
  console.log(`Vendored dependency check: PASS; image-size=2.0.3-tad.1; sha256=${digest(tarball, 'sha256')}`)
}

export function inspectVendoredImageSize(projectRoot) {
  const issues = []
  const forkDir = path.join(projectRoot, 'vendor', 'image-size-fork')
  const tarball = path.join(projectRoot, 'vendor', 'image-size-2.0.3-tad.1.tgz')
  const packageLockPath = path.join(projectRoot, 'package-lock.json')
  const required = [
    path.join(forkDir, 'LICENSE'),
    path.join(forkDir, 'SECURITY-NOTES.md'),
    path.join(forkDir, 'package.json'),
    path.join(forkDir, 'dist', 'index.js'),
    path.join(forkDir, 'dist', 'index.d.ts'),
    tarball,
    packageLockPath,
  ]

  for (const file of required) {
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      issues.push({ code: 'MISSING_VENDORED_SOURCE', message: relative(projectRoot, file) })
    }
  }
  if (issues.length) return issues

  let lock
  let forkPackage
  try { lock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8')) } catch (error) {
    issues.push({ code: 'INVALID_LOCKFILE', message: error.message })
    return issues
  }
  try { forkPackage = JSON.parse(fs.readFileSync(path.join(forkDir, 'package.json'), 'utf8')) } catch (error) {
    issues.push({ code: 'INVALID_FORK_PACKAGE', message: error.message })
    return issues
  }

  const locked = lock.packages?.['node_modules/image-size']
  const rootSpec = lock.packages?.['']?.dependencies?.['image-size']
  if (forkPackage.version !== '2.0.3-tad.1' || locked?.version !== forkPackage.version) {
    issues.push({ code: 'VENDORED_VERSION_MISMATCH', message: `fork=${forkPackage.version ?? 'missing'} lock=${locked?.version ?? 'missing'}` })
  }
  if (rootSpec !== 'file:vendor/image-size-2.0.3-tad.1.tgz' || locked?.resolved !== rootSpec) {
    issues.push({ code: 'VENDORED_RESOLUTION_MISMATCH', message: `root=${rootSpec ?? 'missing'} lock=${locked?.resolved ?? 'missing'}` })
  }
  const actualIntegrity = `sha512-${digest(tarball, 'sha512', 'base64')}`
  if (locked?.integrity !== actualIntegrity) {
    issues.push({ code: 'VENDORED_INTEGRITY_MISMATCH', message: `lock=${locked?.integrity ?? 'missing'} actual=${actualIntegrity}` })
  }

  inspectGitVisibility(projectRoot, forkDir, issues)
  inspectRepackedBytes(projectRoot, forkDir, tarball, issues)
  return issues
}

function inspectGitVisibility(projectRoot, forkDir, issues) {
  const hasGitMetadata = fs.existsSync(path.join(projectRoot, '.git'))
  const probe = spawnSync('git', ['-C', projectRoot, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', windowsHide: true })
  if (probe.status !== 0) {
    if (hasGitMetadata) {
      issues.push({
        code: 'GIT_VISIBILITY_CHECK_FAILED',
        message: `repository probe failed; exit=${probe.status ?? 'spawn-error'}; ${probe.error?.message ?? probe.stderr.trim()}`,
      })
    }
    return
  }
  if (path.resolve(probe.stdout.trim()) !== path.resolve(projectRoot)) {
    if (hasGitMetadata) {
      issues.push({ code: 'GIT_VISIBILITY_CHECK_FAILED', message: `repository root mismatch; actual=${probe.stdout.trim()}` })
    }
    return
  }

  for (const file of listFiles(forkDir)) {
    const rel = relative(projectRoot, file)
    const check = spawnSync('git', ['-C', projectRoot, 'check-ignore', '--quiet', '--', rel], { encoding: 'utf8', windowsHide: true })
    if (check.status === 0) issues.push({ code: 'VENDORED_SOURCE_IGNORED', message: rel })
    else if (check.status !== 1) issues.push({ code: 'GIT_VISIBILITY_CHECK_FAILED', message: `${rel}; exit=${check.status}` })
  }
}

function inspectRepackedBytes(projectRoot, forkDir, canonicalTarball, issues) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tad-image-size-repack-'))
  const packDir = path.join(tempRoot, 'pack')
  const cacheDir = path.join(tempRoot, 'npm-cache')
  fs.mkdirSync(packDir)
  fs.mkdirSync(cacheDir)
  try {
    const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    if (!fs.existsSync(npmCli)) {
      issues.push({ code: 'NPM_CLI_MISSING', message: npmCli })
      return
    }
    const packed = spawnSync(process.execPath, [npmCli, 'pack', forkDir, '--pack-destination', packDir, '--silent'], {
      cwd: projectRoot,
      encoding: 'utf8',
      env: { ...process.env, npm_config_cache: cacheDir },
      windowsHide: true,
    })
    if (packed.status !== 0) {
      issues.push({ code: 'VENDORED_REPACK_FAILED', message: `exit=${packed.status}; ${(packed.stderr ?? packed.error?.message ?? '').trim()}` })
      return
    }
    const name = packed.stdout.trim().split(/\r?\n/).at(-1)
    const rebuilt = path.join(packDir, name ?? '')
    if (!name || !fs.existsSync(rebuilt)) {
      issues.push({ code: 'VENDORED_REPACK_MISSING', message: 'npm pack did not produce a tarball' })
      return
    }
    const expected = digest(canonicalTarball, 'sha512')
    const actual = digest(rebuilt, 'sha512')
    if (actual !== expected) {
      issues.push({ code: 'VENDORED_REPACK_MISMATCH', message: `expected=${expected} actual=${actual}` })
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true })
  }
}

function listFiles(directory) {
  const files = []
  walk(directory)
  return files.sort()
  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) walk(absolute)
      else if (entry.isFile()) files.push(absolute)
    }
  }
}

function digest(file, algorithm, encoding = 'hex') {
  return crypto.createHash(algorithm).update(fs.readFileSync(file)).digest(encoding)
}

function relative(rootDir, file) {
  return path.relative(rootDir, file).split(path.sep).join('/')
}

function parseArgs(argv) {
  const parsed = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith('--')) parsed[key] = true
    else { parsed[key] = next; index += 1 }
  }
  return parsed
}
