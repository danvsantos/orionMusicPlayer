#!/usr/bin/env node
/**
 * Per-platform build script for OrionPlayer.
 * Usage: node scripts/build.mjs [mac|linux|windows]
 *
 * Outputs to:
 *   dist/mac/      — macOS DMG
 *   dist/linux/    — AppImage + DEB (Ubuntu)
 *   dist/windows/  — NSIS installer (.exe)
 *
 * Note: Building the Windows NSIS installer from macOS requires Wine.
 * Install with: brew install --cask wine-stable
 * Without Wine, use a Windows machine or CI (e.g. GitHub Actions) for Windows builds.
 */

import { build, Platform, Arch } from 'electron-builder'
import { execSync } from 'child_process'

const platform = process.argv[2]

if (!['mac', 'linux', 'windows'].includes(platform)) {
  console.error('Usage: node scripts/build.mjs [mac|linux|windows]')
  console.error('')
  console.error('  mac     — macOS DMG  →  dist/mac/')
  console.error('  linux   — AppImage + DEB  →  dist/linux/')
  console.error('  windows — NSIS installer  →  dist/windows/  (requires Wine on macOS/Linux)')
  process.exit(1)
}

const BASE_CONFIG = {
  appId: 'com.orionplayer.app',
  productName: 'OrionPlayer',
  files: ['out/**/*', 'resources/**/*']
}

const PLATFORM_CONFIGS = {
  mac: {
    targets: Platform.MAC.createTarget('dmg'),
    config: {
      ...BASE_CONFIG,
      directories: { output: 'dist/mac' },
      mac: {
        category: 'public.app-category.music',
        icon: 'resources/icons/512x512.png',
        target: ['dmg']
      }
    }
  },

  linux: {
    targets: Platform.LINUX.createTarget(['AppImage', 'deb'], Arch.x64),
    config: {
      ...BASE_CONFIG,
      directories: { output: 'dist/linux' },
      linux: {
        icon: 'resources/icons',
        target: ['AppImage', 'deb'],
        category: 'Audio',
        maintainer: 'OrionPlayer <danvsantos@gmail.com>'
      }
    }
  },

  windows: {
    targets: Platform.WINDOWS.createTarget('nsis', Arch.x64),
    config: {
      ...BASE_CONFIG,
      directories: { output: 'dist/windows' },
      win: {
        icon: 'resources/icons/512x512.png',
        target: [{ target: 'nsis', arch: ['x64'] }]
      },
      nsis: {
        oneClick: false,
        allowElevation: true,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: 'OrionPlayer'
      }
    }
  }
}

// Build Electron/Vite first
console.log('\nBuilding application bundle...')
execSync('npm run build', { stdio: 'inherit' })

console.log(`\nPackaging for ${platform}...`)

try {
  await build(PLATFORM_CONFIGS[platform])
  console.log(`\nBuild complete! Output: dist/${platform}/`)
} catch (err) {
  console.error('\nBuild failed:', err.message || err)
  if (platform === 'windows' && process.platform !== 'win32') {
    console.error('\nTip: Building Windows NSIS installer from macOS/Linux requires Wine.')
    console.error('Install with: brew install --cask wine-stable')
    console.error('Or run this build on a Windows machine / GitHub Actions.')
  }
  process.exit(1)
}
