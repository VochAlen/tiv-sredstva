// Generiše PWA ikone iz logo.svg
// Pokrenite: bun run scripts/generate-icons.ts

import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const logoPath = resolve(process.cwd(), 'public/logo.svg')
const svgBuffer = readFileSync(logoPath)

async function main() {
  console.log('Generating PWA icons from logo.svg...')

  // Generiši 192x192
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(resolve(process.cwd(), 'public/icon-192.png'))
  console.log('✓ Generated public/icon-192.png')

  // Generiši 512x512
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(resolve(process.cwd(), 'public/icon-512.png'))
  console.log('✓ Generated public/icon-512.png')

  // Generiši favicon.ico (samo 32x32 PNG, browser-i prihvataju)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(resolve(process.cwd(), 'public/favicon-32.png'))
  console.log('✓ Generated public/favicon-32.png')

  console.log('Done!')
}

main().catch(console.error)
