import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const MAX_ASSET_BYTES = 10 * 1024 * 1024
const MAX_RASTER_DIMENSION = 8192
const MAX_RASTER_PIXELS = 32 * 1024 * 1024
const SPLASH_PLUGIN = 'expo-splash-screen'
const SPLASH_IMAGE = './assets/splash.png'
const SPLASH_IMAGE_WIDTH = 200
const SPLASH_RESIZE_MODE = 'contain'
const SPLASH_BACKGROUND = '#ffffff'
const FORBIDDEN_LEGACY_ASSET_SHA256 = new Set([
  'c7d0a1bfdedf9e0170cb953a64cbd5658663d98ca1408858fc2cf72f8a62c7dd',
])
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

export function isForbiddenLegacyAssetSha256(value) {
  return FORBIDDEN_LEGACY_ASSET_SHA256.has(value)
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
    const sha256 = createHash('sha256').update(input).digest('hex')
    if (isForbiddenLegacyAssetSha256(sha256)) {
      findings.push({ code: 'LEGACY_PLACEHOLDER_ASSET', file: relative, detail: 'the retired buyer-facing placeholder must not return' })
      continue
    }
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

function splashFinding(code, file, detail) {
  return { code, file, detail }
}

function isInsideRoot(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`)
}

function readPngDimensions(file) {
  const input = fs.readFileSync(file)
  if (actualFormat(input) !== 'png' || input.length < 24 || ascii(input, 12, 16) !== 'IHDR') return null
  return { width: input.readUInt32BE(16), height: input.readUInt32BE(20) }
}

export function validateMobileSplashContract(rootDirectory) {
  const root = path.resolve(rootDirectory)
  const findings = []
  const appJsonPath = path.join(root, 'app.json')
  if (!fs.existsSync(appJsonPath)) {
    return { findings: [splashFinding('APP_CONFIG_MISSING', 'app.json', 'app.json is required for the Mobile splash contract')] }
  }

  let app
  try {
    app = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))
  } catch (error) {
    return { findings: [splashFinding('APP_CONFIG_INVALID', 'app.json', `cannot parse JSON: ${error.message}`)] }
  }

  const expo = app?.expo
  if (!expo || typeof expo !== 'object' || Array.isArray(expo)) {
    return { findings: [splashFinding('EXPO_CONFIG_MISSING', 'app.json', 'top-level expo object is required')] }
  }
  if (Object.hasOwn(expo, 'splash')) {
    findings.push(splashFinding('LEGACY_SPLASH_CONFIG_PRESENT', 'app.json', 'expo.splash must stay absent; use the official plugin only'))
  }

  const plugins = Array.isArray(expo.plugins) ? expo.plugins : []
  const splashPlugins = plugins.filter((entry) => (
    entry === SPLASH_PLUGIN || (Array.isArray(entry) && entry[0] === SPLASH_PLUGIN)
  ))
  if (splashPlugins.length !== 1) {
    findings.push(splashFinding('SPLASH_PLUGIN_COUNT_MISMATCH', 'app.json', `expected exactly one ${SPLASH_PLUGIN} entry; found ${splashPlugins.length}`))
    return { findings }
  }

  const entry = splashPlugins[0]
  const config = Array.isArray(entry) ? entry[1] : null
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    findings.push(splashFinding('SPLASH_PLUGIN_CONFIG_MISSING', 'app.json', `${SPLASH_PLUGIN} must use an options object`))
    return { findings }
  }

  if (config.image !== SPLASH_IMAGE) {
    findings.push(splashFinding('SPLASH_IMAGE_PATH_MISMATCH', 'app.json', `image must be ${SPLASH_IMAGE}; received ${String(config.image)}`))
  }
  if (config.imageWidth !== SPLASH_IMAGE_WIDTH) {
    findings.push(splashFinding('SPLASH_IMAGE_WIDTH_MISMATCH', 'app.json', `imageWidth must be ${SPLASH_IMAGE_WIDTH}; received ${String(config.imageWidth)}`))
  }
  if (config.resizeMode !== SPLASH_RESIZE_MODE) {
    findings.push(splashFinding('SPLASH_RESIZE_MODE_MISMATCH', 'app.json', `resizeMode must be ${SPLASH_RESIZE_MODE}; received ${String(config.resizeMode)}`))
  }
  if (config.backgroundColor !== SPLASH_BACKGROUND) {
    findings.push(splashFinding('SPLASH_BACKGROUND_MISMATCH', 'app.json', `backgroundColor must be ${SPLASH_BACKGROUND}; received ${String(config.backgroundColor)}`))
  }

  if (typeof config.image !== 'string' || config.image.length === 0) return { findings }
  const configuredImage = path.resolve(root, config.image)
  const relativeImage = path.relative(root, configuredImage).split(path.sep).join('/')
  if (!isInsideRoot(root, configuredImage)) {
    findings.push(splashFinding('SPLASH_IMAGE_OUTSIDE_PROJECT', 'app.json', `configured image resolves outside the project: ${relativeImage}`))
    return { findings }
  }
  if (!fs.existsSync(configuredImage) || !fs.statSync(configuredImage).isFile()) {
    findings.push(splashFinding('SPLASH_IMAGE_MISSING', relativeImage, 'configured plugin image does not exist'))
    return { findings }
  }

  const dimensions = readPngDimensions(configuredImage)
  if (!dimensions) {
    findings.push(splashFinding('SPLASH_NOT_PNG', relativeImage, 'splash must be a PNG with a readable IHDR'))
  } else if (dimensions.width !== dimensions.height) {
    findings.push(splashFinding('SPLASH_NOT_SQUARE', relativeImage, `splash must be square; received ${dimensions.width}x${dimensions.height}`))
  }

  const iconPath = path.join(root, 'assets', 'icon.png')
  if (!fs.existsSync(iconPath) || !fs.statSync(iconPath).isFile()) {
    findings.push(splashFinding('ICON_IMAGE_MISSING', 'assets/icon.png', 'icon.png is required for byte-identity validation'))
  } else if (!fs.readFileSync(configuredImage).equals(fs.readFileSync(iconPath))) {
    findings.push(splashFinding('SPLASH_ICON_BYTES_DIFFER', relativeImage, 'splash.png must be byte-identical to assets/icon.png'))
  }

  return { findings }
}

export function checkMobileAssets(rootDirectory) {
  const assetResult = scanMobileAssets(rootDirectory)
  const splashResult = validateMobileSplashContract(rootDirectory)
  return {
    files: assetResult.files,
    findings: [...assetResult.findings, ...splashResult.findings],
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd()
  const result = checkMobileAssets(root)
  if (result.findings.length > 0) {
    console.error(`[check-assets] REJECTED before Metro: ${result.findings.length} unsafe asset finding(s).`)
    for (const finding of result.findings) console.error(`- ${finding.code} ${finding.file}: ${finding.detail}`)
    process.exit(1)
  }
  console.log(`[check-assets] PASS: ${result.files.length} image asset(s), magic bytes, limits and native splash contract verified before Metro.`)
}
