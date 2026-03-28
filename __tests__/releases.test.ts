import { describe, it, expect, beforeEach, jest, mock } from 'bun:test'

const whichMock = jest.fn().mockResolvedValue('')

mock.module('@actions/io', () => ({
  which: whichMock,
  mv: jest.fn(),
  cp: jest.fn(),
  rmRF: jest.fn(),
  mkdirP: jest.fn()
}))

const {
  resolveLatestVersion,
  buildDownloadUrl,
  buildCdnAssetUrl,
  ArchiveType,
  cdnOs,
  cdnArch
} = await import('../src/releases')
const { default: buildOptions } = await import('../src/options')

describe('elide release', () => {
  it('should support resolving the latest version', async () => {
    expect(await resolveLatestVersion()).not.toBeNull()
  })
})

describe('CDN platform mapping', () => {
  it('should map darwin to macos for CDN', () => {
    expect(cdnOs('darwin')).toBe('macos')
  })

  it('should leave linux unchanged', () => {
    expect(cdnOs('linux')).toBe('linux')
  })

  it('should leave windows unchanged', () => {
    expect(cdnOs('windows')).toBe('windows')
  })

  it('should map aarch64 to arm64 for CDN', () => {
    expect(cdnArch('aarch64')).toBe('arm64')
  })

  it('should leave amd64 unchanged', () => {
    expect(cdnArch('amd64')).toBe('amd64')
  })
})

describe('buildCdnAssetUrl', () => {
  it('should append ?source=gha', () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0',
      channel: 'release'
    })
    const url = buildCdnAssetUrl(options, 'tgz')
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0/elide.linux-amd64.tgz?source=gha'
    )
  })

  it('should work for non-archive extensions', () => {
    const options = buildOptions({
      os: 'windows',
      arch: 'amd64',
      version: '1.0.0',
      channel: 'release'
    })
    expect(buildCdnAssetUrl(options, 'msi').toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0/elide.windows-amd64.msi?source=gha'
    )
  })

  it('should use latest as revision when version is latest', () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: 'latest'
    })
    const url = buildCdnAssetUrl(options, 'pkg')
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/nightly/latest/elide.macos-arm64.pkg?source=gha'
    )
  })
})

describe('buildDownloadUrl', () => {
  beforeEach(() => {
    whichMock.mockClear()
    whichMock.mockResolvedValue('')
  })

  // --- Channel: release (Elide 1.0) ---

  it('should build release channel URL for linux-amd64', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0',
      channel: 'release'
    })
    const { url } = await buildDownloadUrl(options)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0/elide.linux-amd64.tgz?source=gha'
    )
  })

  it('should build release channel URL for macos-arm64', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: '1.0.0',
      channel: 'release'
    })
    const { url } = await buildDownloadUrl(options)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0/elide.macos-arm64.tgz?source=gha'
    )
  })

  it('should build release channel URL for macos-amd64', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'amd64',
      version: '1.0.0',
      channel: 'release'
    })
    const { url } = await buildDownloadUrl(options)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0/elide.macos-amd64.tgz?source=gha'
    )
  })

  it('should build release channel URL for windows-amd64', async () => {
    const options = buildOptions({
      os: 'windows',
      arch: 'amd64',
      version: '1.0.0',
      channel: 'release'
    })
    const { url, archiveType } = await buildDownloadUrl(options)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0/elide.windows-amd64.zip?source=gha'
    )
    expect(archiveType).toBe(ArchiveType.ZIP)
  })

  // --- Channel: release (Classic pre-1.0) ---

  it('should build release channel URL for classic 1.0.0-beta10', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0-beta10',
      channel: 'release'
    })
    const { url } = await buildDownloadUrl(options)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0-beta10/elide.linux-amd64.tgz?source=gha'
    )
  })

  it('should build release channel URL for classic darwin-aarch64', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: '1.0.0-alpha7',
      channel: 'release'
    })
    const { url } = await buildDownloadUrl(options)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0-alpha7/elide.macos-arm64.tgz?source=gha'
    )
  })

  // --- Channel: nightly (default) ---

  it('should default to nightly channel', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0'
    })
    const { url } = await buildDownloadUrl(options)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/nightly/1.0.0/elide.linux-amd64.tgz?source=gha'
    )
  })

  it('should use nightly/latest when version is latest', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest'
    })
    const { url } = await buildDownloadUrl(options)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/nightly/latest/elide.linux-amd64.tgz?source=gha'
    )
  })

  // --- Channel: preview ---

  it('should use preview channel when specified', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: 'latest',
      channel: 'preview'
    })
    const { url } = await buildDownloadUrl(options)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/preview/latest/elide.macos-arm64.tgz?source=gha'
    )
  })

  // --- Archive format tests ---

  it('should use zip for Windows', async () => {
    const options = buildOptions({
      os: 'windows',
      arch: 'amd64',
      version: 'latest'
    })
    const { url, archiveType } = await buildDownloadUrl(options)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/nightly/latest/elide.windows-amd64.zip?source=gha'
    )
    expect(archiveType).toBe(ArchiveType.ZIP)
  })

  it('should use txz when xz is available', async () => {
    whichMock.mockResolvedValue('/usr/bin/xz')
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0',
      channel: 'release'
    })
    const { url, archiveType } = await buildDownloadUrl(options)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0/elide.linux-amd64.txz?source=gha'
    )
    expect(archiveType).toBe(ArchiveType.TXZ)
  })
})
