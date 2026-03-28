import { describe, it, expect, beforeEach, jest, mock } from 'bun:test'

// Create mock functions
const execMock = jest.fn().mockResolvedValue(0)
const whichMock = jest.fn().mockResolvedValue('/usr/local/bin/elide')
const downloadToolMock = jest.fn().mockResolvedValue('/tmp/install.sh')
const obtainVersionMock = jest.fn().mockResolvedValue('1.0.0')
const addPathMock = jest.fn()
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
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  addPath: addPathMock
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

const { installViaScript } = await import('../src/install-script')
const { default: buildOptions } = await import('../src/options')

describe('install-script', () => {
  beforeEach(() => {
    execMock.mockClear()
    whichMock.mockClear()
    downloadToolMock.mockClear()
    obtainVersionMock.mockClear()
    addPathMock.mockClear()
    infoMock.mockClear()
    debugMock.mockClear()

    downloadToolMock.mockResolvedValue('/tmp/install.sh')
    execMock.mockResolvedValue(0)
    whichMock.mockResolvedValue('/usr/local/bin/elide')
    obtainVersionMock.mockResolvedValue('1.0.0')
  })

  it('should download and execute the install script', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: 'latest'
    })
    const result = await installViaScript(options)

    expect(downloadToolMock).toHaveBeenCalledWith(
      'https://dl.elide.dev/cli/install.sh'
    )
    expect(execMock).toHaveBeenCalledWith('bash', ['/tmp/install.sh'])
    expect(result.elidePath).toBe('/usr/local/bin/elide')
    expect(result.version.tag_name).toBe('1.0.0')
  })

  it('should pass --version when a specific version is requested', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.2.3'
    })
    await installViaScript(options)

    expect(execMock).toHaveBeenCalledWith('bash', [
      '/tmp/install.sh',
      '--version',
      '1.2.3'
    ])
  })

  it('should fall back to ~/.elide/bin if which fails initially', async () => {
    whichMock
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce('/home/runner/.elide/bin/elide')

    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest'
    })
    const result = await installViaScript(options)

    expect(addPathMock).toHaveBeenCalled()
    expect(result.elidePath).toBe('/home/runner/.elide/bin/elide')
  })
})
