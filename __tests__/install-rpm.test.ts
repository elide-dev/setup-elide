import { describe, it, expect, beforeEach, jest, mock } from 'bun:test'

// Create mock functions
const execMock = jest.fn().mockResolvedValue(0)
const whichMock = jest.fn().mockResolvedValue('/usr/bin/elide')
const downloadToolMock = jest.fn().mockResolvedValue('/tmp/elide.rpm')
const obtainVersionMock = jest.fn().mockResolvedValue('1.0.0')
const buildCdnAssetUrlMock = jest
  .fn()
  .mockReturnValue(
    new URL(
      'https://elide.zip/artifacts/nightly/latest/elide.linux-amd64.rpm?source=gha'
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

const { installViaRpm } = await import('../src/install-rpm')
const { default: buildOptions } = await import('../src/options')

describe('install-rpm', () => {
  beforeEach(() => {
    execMock.mockClear()
    whichMock.mockClear()
    downloadToolMock.mockClear()
    obtainVersionMock.mockClear()
    buildCdnAssetUrlMock.mockClear()
    infoMock.mockClear()
    debugMock.mockClear()

    downloadToolMock.mockResolvedValue('/tmp/elide.rpm')
    execMock.mockResolvedValue(0)
    whichMock.mockResolvedValue('/usr/bin/elide')
    obtainVersionMock.mockResolvedValue('1.0.0')
    buildCdnAssetUrlMock.mockReturnValue(
      new URL(
        'https://elide.zip/artifacts/nightly/latest/elide.linux-amd64.rpm?source=gha'
      )
    )
  })

  it('should construct the RPM URL correctly', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest'
    })
    await installViaRpm(options)

    expect(buildCdnAssetUrlMock).toHaveBeenCalledWith(options, 'rpm')
  })

  it('should install via dnf when dnf is available', async () => {
    // First call: which('dnf', true) -> resolves (dnf available)
    // Second call: which('elide', true) -> resolves to binary path
    whichMock
      .mockResolvedValueOnce('/usr/bin/dnf')
      .mockResolvedValueOnce('/usr/bin/elide')

    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest'
    })
    const result = await installViaRpm(options)

    expect(execMock).toHaveBeenCalledWith('sudo', [
      'dnf',
      'install',
      '-y',
      '/tmp/elide.rpm'
    ])
    expect(result.elidePath).toBe('/usr/bin/elide')
    expect(result.version.tag_name).toBe('1.0.0')
  })

  it('should fall back to rpm when dnf is not available', async () => {
    // First call: which('dnf', true) -> rejects (dnf not found)
    // Second call: which('elide', true) -> resolves to binary path
    whichMock
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce('/usr/bin/elide')

    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest'
    })
    const result = await installViaRpm(options)

    expect(execMock).toHaveBeenCalledWith('sudo', [
      'rpm',
      '-i',
      '/tmp/elide.rpm'
    ])
    expect(execMock).not.toHaveBeenCalledWith(
      'sudo',
      expect.arrayContaining(['dnf'])
    )
    expect(result.elidePath).toBe('/usr/bin/elide')
    expect(result.version.tag_name).toBe('1.0.0')
  })

  it('should return correct release info', async () => {
    whichMock
      .mockResolvedValueOnce('/usr/bin/dnf')
      .mockResolvedValueOnce('/usr/bin/elide')

    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.2.3'
    })
    const result = await installViaRpm(options)

    expect(result.elidePath).toBe('/usr/bin/elide')
    expect(result.elideBin).toBe('/usr/bin')
    expect(result.elideHome).toBe('/usr/bin')
    expect(result.version.tag_name).toBe('1.0.0')
    expect(result.version.userProvided).toBe(true)
  })
})
