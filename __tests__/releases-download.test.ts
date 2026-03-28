import { describe, it, expect, beforeEach, jest, mock } from 'bun:test'

// Mock functions
const debugMock = jest.fn()
const infoMock = jest.fn()
const errorMock = jest.fn()
const warningMock = jest.fn()
const setFailedMock = jest.fn()
const whichMock = jest.fn().mockResolvedValue('')
const mvMock = jest.fn().mockResolvedValue(undefined)
const downloadToolMock = jest.fn().mockResolvedValue('/tmp/elide.tgz')
const extractTarMock = jest.fn().mockResolvedValue('/opt/elide')
const extractZipMock = jest.fn().mockResolvedValue('/opt/elide')
const cacheDirMock = jest.fn().mockResolvedValue('/cache/elide')
const findMock = jest.fn().mockReturnValue('')
const obtainVersionMock = jest.fn().mockResolvedValue('1.0.0')
const getOctokitMock = jest.fn()
const requestMock = jest.fn().mockResolvedValue({
  data: { tag_name: '1.0.0', name: 'Elide 1.0.0' }
})

mock.module('@actions/core', () => ({
  debug: debugMock,
  info: infoMock,
  error: errorMock,
  warning: warningMock,
  getInput: jest.fn().mockReturnValue(''),
  setFailed: setFailedMock,
  setOutput: jest.fn(),
  addPath: jest.fn()
}))
mock.module('@actions/io', () => ({
  which: whichMock,
  mv: mvMock,
  cp: jest.fn(),
  rmRF: jest.fn(),
  mkdirP: jest.fn()
}))
mock.module('@actions/tool-cache', () => ({
  downloadTool: downloadToolMock,
  extractTar: extractTarMock,
  extractZip: extractZipMock,
  cacheDir: cacheDirMock,
  find: findMock
}))
mock.module('@actions/github', () => ({
  getOctokit: getOctokitMock
}))
mock.module('octokit', () => ({
  Octokit: class {
    request = requestMock
  }
}))
mock.module('../src/command', () => ({
  obtainVersion: obtainVersionMock,
  elideInfo: jest.fn()
}))

const { downloadRelease, resolveLatestVersion } = await import(
  '../src/releases'
)
const { default: buildOptions } = await import('../src/options')

describe('resolveLatestVersion', () => {
  beforeEach(() => {
    requestMock.mockClear()
    getOctokitMock.mockClear()
    requestMock.mockResolvedValue({
      data: { tag_name: '1.0.0', name: 'Elide 1.0.0' }
    })
  })

  it('should resolve without a token using Octokit', async () => {
    const result = await resolveLatestVersion()
    expect(result.tag_name).toBe('1.0.0')
    expect(result.name).toBe('Elide 1.0.0')
    expect(result.userProvided).toBe(false)
  })

  it('should use github.getOctokit when token is provided', async () => {
    getOctokitMock.mockReturnValue({ request: requestMock })
    const result = await resolveLatestVersion('ghp_test_token')
    expect(getOctokitMock).toHaveBeenCalledWith('ghp_test_token')
    expect(result.userProvided).toBe(true)
  })

  it('should retry on transient failure and succeed', async () => {
    requestMock
      .mockRejectedValueOnce(new Error('rate limit exceeded'))
      .mockResolvedValueOnce({
        data: { tag_name: '2.0.0', name: 'Elide 2.0.0' }
      })
    const result = await resolveLatestVersion()
    expect(result.tag_name).toBe('2.0.0')
    expect(requestMock).toHaveBeenCalledTimes(2)
    expect(warningMock).toHaveBeenCalledWith(
      expect.stringContaining('Retrying')
    )
  })

  it('should throw after exhausting retries', async () => {
    requestMock.mockRejectedValue(new Error('quota exhausted'))
    await expect(resolveLatestVersion()).rejects.toThrow('quota exhausted')
    expect(requestMock).toHaveBeenCalledTimes(3)
    expect(errorMock).toHaveBeenCalledWith(
      expect.stringContaining('rate limit'),
      expect.objectContaining({ title: 'Rate Limited' })
    )
  })

  it('should warn when no token is provided', async () => {
    await resolveLatestVersion()
    expect(warningMock).toHaveBeenCalledWith(
      expect.stringContaining('No GitHub token provided')
    )
  })
})

describe('downloadRelease', () => {
  beforeEach(() => {
    debugMock.mockClear()
    infoMock.mockClear()
    errorMock.mockClear()
    warningMock.mockClear()
    setFailedMock.mockClear()
    whichMock.mockClear()
    downloadToolMock.mockClear()
    extractTarMock.mockClear()
    extractZipMock.mockClear()
    cacheDirMock.mockClear()
    findMock.mockClear()
    obtainVersionMock.mockClear()
    requestMock.mockClear()
    mvMock.mockClear()

    whichMock.mockResolvedValue('')
    downloadToolMock.mockResolvedValue('/tmp/elide.tgz')
    extractTarMock.mockResolvedValue('/opt/elide')
    extractZipMock.mockResolvedValue('/opt/elide')
    cacheDirMock.mockResolvedValue('/cache/elide')
    findMock.mockReturnValue('')
    obtainVersionMock.mockResolvedValue('1.0.0')
    requestMock.mockResolvedValue({
      data: { tag_name: '1.0.0', name: 'Elide 1.0.0' }
    })
  })

  it('should download and cache a release for latest version', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest'
    })
    const result = await downloadRelease(options)
    expect(downloadToolMock).toHaveBeenCalled()
    expect(cacheDirMock).toHaveBeenCalled()
    expect(result.version.tag_name).toBe('1.0.0')
  })

  it('should download a specific version', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.2.3'
    })
    const result = await downloadRelease(options)
    expect(downloadToolMock).toHaveBeenCalled()
    expect(result.version.tag_name).toBe('1.2.3')
    expect(result.version.userProvided).toBe(true)
  })

  it('should use a cached copy when available', async () => {
    findMock.mockReturnValue('/cached/elide')
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0'
    })
    const result = await downloadRelease(options)
    expect(downloadToolMock).not.toHaveBeenCalled()
    expect(result.elideBin).toContain('/cached/elide')
  })

  it('should skip cache when no_cache is true', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0',
      no_cache: true
    })
    await downloadRelease(options)
    expect(downloadToolMock).toHaveBeenCalled()
    expect(cacheDirMock).not.toHaveBeenCalled()
  })

  it('should handle custom_url downloads', async () => {
    downloadToolMock.mockResolvedValue('/tmp/custom.tgz')
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest',
      custom_url: 'https://example.com/elide-custom.tgz',
      version_tag: 'custom-1'
    })
    const result = await downloadRelease(options)
    expect(downloadToolMock).toHaveBeenCalledWith(
      'https://example.com/elide-custom.tgz'
    )
    expect(result.version.userProvided).toBe(true)
  })

  it('should detect txz custom_url archive type', async () => {
    downloadToolMock.mockResolvedValue('/tmp/custom.txz')
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest',
      custom_url: 'https://example.com/elide.txz'
    })
    await downloadRelease(options)
    // The txz path will attempt xz extraction; verify it was called
    expect(downloadToolMock).toHaveBeenCalled()
  })

  it('should detect zip custom_url archive type', async () => {
    downloadToolMock.mockResolvedValue('/tmp/custom.zip')
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest',
      custom_url: 'https://example.com/elide.zip'
    })
    await downloadRelease(options)
    expect(downloadToolMock).toHaveBeenCalled()
  })

  it('should use zip extraction for Windows', async () => {
    const options = buildOptions({
      os: 'windows',
      arch: 'amd64',
      version: '1.0.0'
    })
    const result = await downloadRelease(options)
    expect(extractZipMock).toHaveBeenCalled()
    expect(result.version.tag_name).toBe('1.0.0')
  })

  it('should handle download failure', async () => {
    downloadToolMock.mockRejectedValue(new Error('network error'))
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0'
    })
    await expect(downloadRelease(options)).rejects.toThrow('network error')
    expect(errorMock).toHaveBeenCalled()
  })

  it('should handle custom_url download failure', async () => {
    downloadToolMock.mockRejectedValue(new Error('custom download failed'))
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest',
      custom_url: 'https://example.com/bad.tgz'
    })
    await expect(downloadRelease(options)).rejects.toThrow(
      'custom download failed'
    )
    expect(errorMock).toHaveBeenCalled()
  })

  it('should gracefully handle extraction failure', async () => {
    extractTarMock.mockRejectedValue(new Error('tar failed'))
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0'
    })
    // Should not throw — falls back to elideHome
    await downloadRelease(options)
    expect(warningMock).toHaveBeenCalledWith(
      expect.stringContaining('Failed to extract')
    )
  })

  // --- Toolchain caching tests (Classic + 1.0) ---

  describe('toolchain caching (Elide 1.0)', () => {
    it('first run should download, extract, and cache', async () => {
      findMock.mockReturnValue('')
      const options = buildOptions({
        os: 'linux',
        arch: 'amd64',
        version: '1.0.0'
      })
      const result = await downloadRelease(options)

      // Should probe the cache first
      expect(findMock).toHaveBeenCalledWith('elide', '1.0.0', 'amd64')
      // Cache miss → download
      expect(downloadToolMock).toHaveBeenCalled()
      // Extract
      expect(extractTarMock).toHaveBeenCalled()
      // Store in cache
      expect(cacheDirMock).toHaveBeenCalledWith(
        expect.any(String),
        'elide',
        '1.0.0',
        'amd64'
      )
      expect(result.version.tag_name).toBe('1.0.0')
    })

    it('second run should use cached copy without downloading', async () => {
      findMock.mockReturnValue('/cache/tools/elide/1.0.0/amd64')
      const options = buildOptions({
        os: 'linux',
        arch: 'amd64',
        version: '1.0.0'
      })
      const result = await downloadRelease(options)

      // Should probe cache and find it
      expect(findMock).toHaveBeenCalledWith('elide', '1.0.0', 'amd64')
      // Should NOT download or extract
      expect(downloadToolMock).not.toHaveBeenCalled()
      expect(extractTarMock).not.toHaveBeenCalled()
      expect(cacheDirMock).not.toHaveBeenCalled()
      // Should use cached paths
      expect(result.elideBin).toBe('/cache/tools/elide/1.0.0/amd64/bin')
      expect(infoMock).toHaveBeenCalledWith(
        expect.stringContaining('Using cached copy')
      )
    })
  })

  describe('toolchain caching (Elide Classic)', () => {
    it('first run should download and cache classic version', async () => {
      findMock.mockReturnValue('')
      const options = buildOptions({
        os: 'linux',
        arch: 'amd64',
        version: '1.0.0-beta10'
      })
      const result = await downloadRelease(options)

      expect(findMock).toHaveBeenCalledWith('elide', '1.0.0-beta10', 'amd64')
      expect(downloadToolMock).toHaveBeenCalled()
      expect(cacheDirMock).toHaveBeenCalledWith(
        expect.any(String),
        'elide',
        '1.0.0-beta10',
        'amd64'
      )
      expect(result.version.tag_name).toBe('1.0.0-beta10')
    })

    it('second run should use cached classic version', async () => {
      findMock.mockReturnValue('/cache/tools/elide/1.0.0-beta10/amd64')
      const options = buildOptions({
        os: 'linux',
        arch: 'amd64',
        version: '1.0.0-beta10'
      })
      const result = await downloadRelease(options)

      expect(findMock).toHaveBeenCalledWith('elide', '1.0.0-beta10', 'amd64')
      expect(downloadToolMock).not.toHaveBeenCalled()
      expect(extractTarMock).not.toHaveBeenCalled()
      expect(cacheDirMock).not.toHaveBeenCalled()
      expect(result.elideBin).toBe('/cache/tools/elide/1.0.0-beta10/amd64/bin')
      expect(infoMock).toHaveBeenCalledWith(
        expect.stringContaining('Using cached copy')
      )
    })

    it('should cache alpha versions separately', async () => {
      findMock.mockReturnValue('')
      const options = buildOptions({
        os: 'darwin',
        arch: 'aarch64',
        version: '1.0.0-alpha9'
      })
      await downloadRelease(options)

      expect(findMock).toHaveBeenCalledWith('elide', '1.0.0-alpha9', 'aarch64')
      expect(cacheDirMock).toHaveBeenCalledWith(
        expect.any(String),
        'elide',
        '1.0.0-alpha9',
        'aarch64'
      )
    })
  })

  describe('toolchain caching (cross-version isolation)', () => {
    it('classic and 1.0 should not share cache entries', async () => {
      // Simulate 1.0 cached but classic not
      findMock.mockImplementation(
        (_name: string, version: string, _arch: string) => {
          if (version === '1.0.0') return '/cache/tools/elide/1.0.0/amd64'
          return '' // classic not cached
        }
      )

      const classicOpts = buildOptions({
        os: 'linux',
        arch: 'amd64',
        version: '1.0.0-beta10'
      })
      await downloadRelease(classicOpts)
      // Classic should still download (no cache hit)
      expect(downloadToolMock).toHaveBeenCalled()

      downloadToolMock.mockClear()
      extractTarMock.mockClear()

      const modernOpts = buildOptions({
        os: 'linux',
        arch: 'amd64',
        version: '1.0.0'
      })
      await downloadRelease(modernOpts)
      // 1.0 should use cache (no download)
      expect(downloadToolMock).not.toHaveBeenCalled()
    })

    it('different architectures should not share cache', async () => {
      findMock.mockImplementation(
        (_name: string, _version: string, arch: string) => {
          if (arch === 'amd64') return '/cache/tools/elide/1.0.0/amd64'
          return ''
        }
      )

      const arm64Opts = buildOptions({
        os: 'darwin',
        arch: 'aarch64',
        version: '1.0.0'
      })
      await downloadRelease(arm64Opts)
      // arm64 should download (no cache for this arch)
      expect(downloadToolMock).toHaveBeenCalled()
      expect(findMock).toHaveBeenCalledWith('elide', '1.0.0', 'aarch64')
    })
  })
})
