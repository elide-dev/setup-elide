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
  toSemverCacheKey,
  ArchiveType,
  cdnOs,
  cdnArch
} = await import('../src/releases')
const { default: buildOptions } = await import('../src/options')

describe('toSemverCacheKey', () => {
  it('should leave plain semver unchanged', () => {
    expect(toSemverCacheKey('1.0.0')).toBe('1.0.0')
  })

  it('should leave semver prerelease unchanged', () => {
    expect(toSemverCacheKey('1.0.0-beta10')).toBe('1.0.0-beta10')
  })

  it('should convert nightly tag to prerelease form', () => {
    expect(toSemverCacheKey('nightly-20260328')).toBe('0.0.0-nightly.20260328')
  })

  it('should strip dashes from nightly date portion', () => {
    expect(toSemverCacheKey('nightly-2026-03-28')).toBe(
      '0.0.0-nightly.20260328'
    )
  })

  it('should convert build metadata tag to prerelease form', () => {
    expect(toSemverCacheKey('1.4.0+20260707')).toBe('1.4.0-build.20260707')
  })

  it('should preserve prerelease when build metadata is present', () => {
    expect(toSemverCacheKey('1.0.0-beta10+20260707')).toBe(
      '1.0.0-beta10-build.20260707'
    )
  })

  it('should handle multi-part build metadata', () => {
    // e.g. if the tag itself embeds date+commit: 1.4.0+20260707.abc123
    expect(toSemverCacheKey('1.4.0+20260707.abc123')).toBe(
      '1.4.0-build.20260707.abc123'
    )
  })

  it('should pass through build metadata with invalid semver identifier characters unchanged', () => {
    // An underscore isn't a valid semver identifier character; converting
    // this to a "-build.foo_bar" prerelease would itself not be valid
    // semver, defeating the point of toSemverCacheKey. Leave it unchanged
    // rather than emit an unusable cache key.
    expect(toSemverCacheKey('1.0.0+foo_bar')).toBe('1.0.0+foo_bar')
  })

  it('should not treat a non-semver "+"-containing string as build metadata', () => {
    expect(toSemverCacheKey('myfork+patch1')).toBe('myfork+patch1')
  })
})

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
