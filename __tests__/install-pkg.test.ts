import { describe, it, expect, beforeEach, jest, mock } from 'bun:test'

// Create mock functions
const execMock = jest.fn().mockResolvedValue(0)
const whichMock = jest.fn().mockResolvedValue('/usr/local/bin/elide')
const downloadToolMock = jest.fn().mockResolvedValue('/tmp/elide.pkg')
const obtainVersionMock = jest.fn().mockResolvedValue('1.0.0')
const buildCdnAssetUrlMock = jest
  .fn()
  .mockReturnValue(
    new URL(
      'https://elide.zip/artifacts/nightly/latest/elide.macos-arm64.pkg?source=gha'
    )
  )
const infoMock = jest.fn()
const debugMock = jest.fn()

// Mock modules before import
mock.module('@actions/exec', () => ({
  exec: execMock,
  getExecOutput: jest.fn()
}))
mock.module('@actions/io', () => ({
  which: whichMock,
  mv: jest.fn(),
  cp: jest.fn(),
  rmRF: jest.fn(),
  mkdirP: jest.fn()
}))
mock.module('@actions/core', () => ({
  info: infoMock,
  debug: debugMock,
  error: jest.fn(),
  warning: jest.fn(),
  getInput: jest.fn().mockReturnValue(''),
  getBooleanInput: jest.fn().mockReturnValue(true),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  addPath: jest.fn()
}))
mock.module('@actions/tool-cache', () => ({
  downloadTool: downloadToolMock,
  extractTar: jest.fn(),
  extractZip: jest.fn(),
  cacheDir: jest.fn(),
  find: jest.fn()
}))
mock.module('../src/command', () => ({
  obtainVersion: obtainVersionMock,
  elideInfo: jest.fn()
}))
mock.module('../src/releases', () => ({
  buildCdnAssetUrl: buildCdnAssetUrlMock
}))

const { installViaPkg } = await import('../src/install-pkg')
const { default: buildOptions } = await import('../src/options')

describe('install-pkg', () => {
  beforeEach(() => {
    execMock.mockClear()
    whichMock.mockClear()
    downloadToolMock.mockClear()
    obtainVersionMock.mockClear()
    buildCdnAssetUrlMock.mockClear()
    infoMock.mockClear()
    debugMock.mockClear()

    downloadToolMock.mockResolvedValue('/tmp/elide.pkg')
    execMock.mockResolvedValue(0)
    whichMock.mockResolvedValue('/usr/local/bin/elide')
    obtainVersionMock.mockResolvedValue('1.0.0')
    buildCdnAssetUrlMock.mockReturnValue(
      new URL(
        'https://elide.zip/artifacts/nightly/latest/elide.macos-arm64.pkg?source=gha'
      )
    )
  })

  it('should construct the URL correctly via buildCdnAssetUrl', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: 'latest'
    })
    await installViaPkg(options)

    expect(buildCdnAssetUrlMock).toHaveBeenCalledWith(options, 'pkg')
  })

  it('should call sudo installer -pkg with the downloaded path', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: 'latest'
    })
    await installViaPkg(options)

    expect(downloadToolMock).toHaveBeenCalledWith(
      'https://elide.zip/artifacts/nightly/latest/elide.macos-arm64.pkg?source=gha'
    )
    expect(execMock).toHaveBeenCalledWith('sudo', [
      'installer',
      '-pkg',
      '/tmp/elide.pkg',
      '-target',
      '/'
    ])
  })

  it('should return the correct elidePath and version', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: 'latest'
    })
    const result = await installViaPkg(options)

    expect(result.elidePath).toBe('/usr/local/bin/elide')
    expect(result.version.tag_name).toBe('1.0.0')
    expect(result.elideBin).toBe('/usr/local/bin')
    expect(result.elideHome).toBe('/usr/local/bin')
  })
})
