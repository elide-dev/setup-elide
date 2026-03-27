import { describe, it, expect, beforeEach, jest, mock } from 'bun:test'

const whichMock = jest.fn().mockResolvedValue('')

mock.module('@actions/io', () => ({
  which: whichMock,
  mv: jest.fn(),
  cp: jest.fn(),
  rmRF: jest.fn(),
  mkdirP: jest.fn()
}))

const { resolveLatestVersion, buildDownloadUrl, ArchiveType, cdnOs, cdnArch } =
  await import('../src/releases')
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

describe('buildDownloadUrl', () => {
  beforeEach(() => {
    whichMock.mockClear()
    whichMock.mockResolvedValue('')
  })

  // --- Elide 1.0 tests (release channel, semver tags) ---

  it('should build correct URL for Elide 1.0 linux-amd64', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0'
    })
    const version = { tag_name: '1.0.0', userProvided: true }
    const { url } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0/elide.linux-amd64.tgz'
    )
  })

  it('should build correct URL for Elide 1.0 macos-arm64 (darwin->macos, aarch64->arm64)', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: '1.0.0'
    })
    const version = { tag_name: '1.0.0', userProvided: true }
    const { url } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0/elide.macos-arm64.tgz'
    )
  })

  it('should build correct URL for Elide 1.0 macos-amd64', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'amd64',
      version: '1.0.0'
    })
    const version = { tag_name: '1.0.0', userProvided: true }
    const { url } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0/elide.macos-amd64.tgz'
    )
  })

  it('should build correct URL for Elide 1.0 windows-amd64', async () => {
    const options = buildOptions({
      os: 'windows',
      arch: 'amd64',
      version: '1.0.0'
    })
    const version = { tag_name: '1.0.0', userProvided: true }
    const { url, archiveType } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0/elide.windows-amd64.zip'
    )
    expect(archiveType).toBe(ArchiveType.ZIP)
  })

  // --- Classic tests (pre-1.0 versions like 1.0.0-beta10) ---

  it('should build correct URL for classic release (1.0.0-beta10)', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0-beta10'
    })
    const version = { tag_name: '1.0.0-beta10', userProvided: true }
    const { url } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0-beta10/elide.linux-amd64.tgz'
    )
  })

  it('should build correct URL for classic darwin-aarch64', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: '1.0.0-alpha7'
    })
    const version = { tag_name: '1.0.0-alpha7', userProvided: true }
    const { url } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0-alpha7/elide.macos-arm64.tgz'
    )
  })

  // --- Channel tests ---

  it('should use nightly channel and strip prefix from nightly tags', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0'
    })
    const version = { tag_name: 'nightly-20260323', userProvided: false }
    const { url, archiveType } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/nightly/20260323/elide.linux-amd64.tgz'
    )
    expect(archiveType).toBe(ArchiveType.GZIP)
  })

  it('should use preview channel and strip prefix from preview tags', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: '1.0.0'
    })
    const version = { tag_name: 'preview-20260323', userProvided: false }
    const { url } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/preview/20260323/elide.macos-arm64.tgz'
    )
  })

  it('should use "latest" revision when version is latest', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest'
    })
    const version = { tag_name: 'nightly-20260323', userProvided: false }
    const { url } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/nightly/latest/elide.linux-amd64.tgz'
    )
  })

  // --- Archive format tests ---

  it('should use zip for Windows', async () => {
    const options = buildOptions({
      os: 'windows',
      arch: 'amd64',
      version: 'latest'
    })
    const version = { tag_name: 'nightly-20260323', userProvided: false }
    const { url, archiveType } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/nightly/latest/elide.windows-amd64.zip'
    )
    expect(archiveType).toBe(ArchiveType.ZIP)
  })

  it('should use txz when xz is available', async () => {
    whichMock.mockResolvedValue('/usr/bin/xz')
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0'
    })
    const version = { tag_name: '1.0.0', userProvided: true }
    const { url, archiveType } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://elide.zip/artifacts/release/1.0.0/elide.linux-amd64.txz'
    )
    expect(archiveType).toBe(ArchiveType.TXZ)
  })
})
