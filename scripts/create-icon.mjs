import { Resvg } from '@resvg/resvg-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const svgPath = join(root, 'resources', 'icon.svg')
const svg = readFileSync(svgPath, 'utf-8')

mkdirSync(join(root, 'resources', 'icons'), { recursive: true })

// Generate sizes needed for macOS ICNS and Linux
const sizes = [16, 32, 48, 64, 128, 256, 512, 1024]

for (const size of sizes) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    font: { loadSystemFonts: false }
  })
  const png = resvg.render().asPng()
  const out = join(root, 'resources', 'icons', `${size}x${size}.png`)
  writeFileSync(out, png)
  console.log(`  ✓ ${size}x${size}.png`)
}

// Main icon.png used by Electron window + electron-builder
const resvg512 = new Resvg(svg, {
  fitTo: { mode: 'width', value: 512 },
  font: { loadSystemFonts: false }
})
writeFileSync(join(root, 'resources', 'icon.png'), resvg512.render().asPng())
console.log('  ✓ icon.png (512×512) — main app icon')
