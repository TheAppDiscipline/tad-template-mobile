import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_ASSET_BYTES = 10 * 1024 * 1024
const MAX_RASTER_DIMENSION = 8192
const MAX_RASTER_PIXELS = 32 * 1024 * 1024
const IMAGE_EXTENSIONS = new Set([
  '.bmp', '.gif', '.jpeg', '.jpg', '.ktx', '.png', '.psd', '.svg', '.tiff', '.webp',
])
const SKIP_DIRECTORIES = new Set([
  '.expo', '.git', '.discipline', 'coverage', 'dist', 'node_modules', 'vendor',
])

function ascii(input, start, end) {
  return input.subarray(start, end).toString('ascii')
}

function startsWith(input, signature) {
  return input.length >= signature.length && signature.every((byte, index) => input[index] === byte)
}

function dangerousFormat(input) {
  if (ascii(input, 0, 4) === 'icns') return 'ICNS'
  if (startsWith(input, [0xff, 0x0a])) return 'JPEG XL codestream'
  if (ascii(input, 4, 8) === 'JXL ') return 'JPEG XL container'
  if (ascii(input, 4, 8) === 'ftyp') {
    const brand = ascii(input, 8, 12)
    if (['avif', 'mif1', 'msf1', 'heic', 'heix', 'hevc', 'hevx'].includes(brand)) {
      return `HEIF-family (${brand})`
    }
  }
  return null
}

function actualFormat(input) {
  if (startsWith(input, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png'
  if (startsWith(input, [0xff, 0xd8, 0xff])) return 'jpg'
  if (['GIF87a', 'GIF89a'].includes(ascii(input, 0, 6))) return 'gif'
  if (ascii(input, 0, 4) === 'RIFF' && ascii(input, 8, 12) === 'WEBP') return 'webp'
  if (ascii(input, 0, 2) === 'BM') return 'bmp'
  if (ascii(input, 0, 4) === '8BPS') return 'psd'
  if (startsWith(input, [0x49, 0x49, 0x2a, 0x00]) || startsWith(input, [0x4d, 0x4d, 0x00, 0x2a])) return 'tiff'
  if (startsWith(input, [0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a])) return 'ktx'
  if (startsWith(input, [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a])) return 'ktx'
  const text = input.subarray(0, Math.min(input.length, 4096)).toString('utf8').replace(/^\uFEFF/, '')
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b/i.test(text)) return 'svg'
  return null
}

function expectedFormat(extension) {
  if (extension === '.jpeg' || extension === '.jpg') return 'jpg'
  return extension.slice(1)
}

function walk(directory, files) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute, files)
    else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(absolute)
  }
}

export function scanMobileAssets(rootDirectory) {
  const root = path.resolve(rootDirectory)
  const files = []
  const findings = []
  walk(root, files)

  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join('/')
    const stat = fs.statSync(file)
    if (stat.size === 0) {
      findings.push({ code: 'EMPTY_ASSET', file: relative, detail: 'image asset is empty' })
      continue
    }
    if (stat.size > MAX_ASSET_BYTES) {
      findings.push({ code: 'ASSET_TOO_LARGE', file: relative, detail: `${stat.size} bytes exceeds ${MAX_ASSET_BYTES}` })
      continue
    }

    const input = fs.readFileSync(file)
    const dangerous = dangerousFormat(input)
    if (dangerous) {
      findings.push({ code: 'DANGEROUS_IMAGE_FORMAT', file: relative, detail: `${dangerous} is rejected before Metro` })
      continue
    }

    const actual = actualFormat(input)
    const expected = expectedFormat(path.extname(file).toLowerCase())
    if (actual !== expected) {
      findings.push({ code: 'IMAGE_MAGIC_MISMATCH', file: relative, detail: `extension expects ${expected}; magic bytes identify ${actual ?? 'unknown'}` })
      continue
    }

    if (actual === 'png' && input.length >= 24 && ascii(input, 12, 16) === 'IHDR') {
      const width = input.readUInt32BE(16)
      const height = input.readUInt32BE(20)
      if (width === 0 || height === 0 || width > MAX_RASTER_DIMENSION || height > MAX_RASTER_DIMENSION || width * height > MAX_RASTER_PIXELS) {
        findings.push({ code: 'UNSAFE_IMAGE_DIMENSIONS', file: relative, detail: `${width}x${height} exceeds the safe PNG bounds` })
      }
    }
  }

  return { files, findings }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()
  const result = scanMobileAssets(root)
  if (result.findings.length > 0) {
    console.error(`[check-assets] REJECTED before Metro: ${result.findings.length} unsafe asset finding(s).`)
    for (const finding of result.findings) console.error(`- ${finding.code} ${finding.file}: ${finding.detail}`)
    process.exit(1)
  }
  console.log(`[check-assets] PASS: ${result.files.length} image asset(s), magic bytes and limits verified before Metro.`)
}
