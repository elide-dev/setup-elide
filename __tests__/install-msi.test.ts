import { describe, it, expect, beforeEach, jest, mock } from 'bun:test'

// Create mock functions
const execMock = jest.fn().mockResolvedValue(0)
const whichMock = jest.fn().mockResolvedValue('C:\\Elide\\bin\\elide.exe')
const downloadToolMock = jest.fn().mockResolvedValue('/tmp/elide.msi')
const obtainVersionMock = jest.fn().mockResolvedValue('1.0.0')
const buildCdnAssetUrlMock = jest
  .fn()
  .mockReturnValue(
    new URL(
      'https://elide.zip/artifacts/nightly/latest/elide.windows-amd64.msi?source=gha'
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

const { installViaMsi } = await import('../src/install-msi')
const { default: buildOptions } = await import('../src/options')

describe('install-msi', () => {
  beforeEach(() => {
    execMock.mockClear()
    whichMock.mockClear()
    downloadToolMock.mockClear()
    obtainVersionMock.mockClear()
    buildCdnAssetUrlMock.mockClear()
    infoMock.mockClear()
    debugMock.mockClear()

    downloadToolMock.mockResolvedValue('/tmp/elide.msi')
    execMock.mockResolvedValue(0)
    whichMock.mockResolvedValue('C:\\Elide\\bin\\elide.exe')
    obtainVersionMock.mockResolvedValue('1.0.0')
    buildCdnAssetUrlMock.mockReturnValue(
      new URL(
        'https://elide.zip/artifacts/nightly/latest/elide.windows-amd64.msi?source=gha'
      )
    )
  })

  it('should construct the CDN URL with msi extension', async () => {
    const options = buildOptions({
      os: 'windows',
      arch: 'amd64',
      version: 'latest'
    })
    await installViaMsi(options)

    expect(buildCdnAssetUrlMock).toHaveBeenCalledWith(options, 'msi')
  })

  it('should call msiexec with correct arguments', async () => {
    const options = buildOptions({
      os: 'windows',
      arch: 'amd64',
      version: 'latest'
    })
    await installViaMsi(options)

    expect(downloadToolMock).toHaveBeenCalledWith(
      'https://elide.zip/artifacts/nightly/latest/elide.windows-amd64.msi?source=gha'
    )
    expect(execMock).toHaveBeenCalledWith('msiexec', [
      '/i',
      '/tmp/elide.msi',
      '/quiet',
      '/norestart',
      `INSTALLDIR=${options.install_path}`
    ])
  })

  it('should return correct elidePath and version', async () => {
    const options = buildOptions({
      os: 'windows',
      arch: 'amd64',
      version: 'latest'
    })
    const result = await installViaMsi(options)

    expect(result.elidePath).toBe('C:\\Elide\\bin\\elide.exe')
    expect(result.version.tag_name).toBe('1.0.0')
    expect(result.version.userProvided).toBe(false)
  })

  it('should mark version as userProvided when not latest', async () => {
    const options = buildOptions({
      os: 'windows',
      arch: 'amd64',
      version: '1.2.3'
    })
    const result = await installViaMsi(options)

    expect(result.version.userProvided).toBe(true)
  })
})
