import { describe, it, expect, beforeEach, jest, mock } from 'bun:test'

// Create mock functions
const execMock = jest.fn().mockResolvedValue(0)
const whichMock = jest.fn().mockResolvedValue('/usr/bin/elide')
const obtainVersionMock = jest.fn().mockResolvedValue('1.0.0')
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
  addPath: jest.fn()
}))
mock.module('../src/command', () => ({
  obtainVersion: obtainVersionMock,
  elideInfo: jest.fn()
}))

const { installViaApt } = await import('../src/install-apt')
const { default: buildOptions } = await import('../src/options')

describe('install-apt', () => {
  beforeEach(() => {
    execMock.mockClear()
    whichMock.mockClear()
    obtainVersionMock.mockClear()
    infoMock.mockClear()
    debugMock.mockClear()

    execMock.mockResolvedValue(0)
    whichMock.mockResolvedValue('/usr/bin/elide')
    obtainVersionMock.mockResolvedValue('1.0.0')
  })

  it('should run the correct apt commands for amd64', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest'
    })
    const result = await installViaApt(options)

    // GPG key download
    expect(execMock).toHaveBeenCalledWith('bash', [
      '-c',
      expect.stringContaining('keys.elide.dev/gpg.key')
    ])

    // apt source with correct arch
    expect(execMock).toHaveBeenCalledWith(
      'sudo',
      ['tee', '/etc/apt/sources.list.d/elide.list'],
      expect.objectContaining({
        input: expect.any(Buffer)
      })
    )

    // apt-get update
    expect(execMock).toHaveBeenCalledWith('sudo', ['apt-get', 'update', '-qq'])

    // apt-get install elide (no version pin for latest)
    expect(execMock).toHaveBeenCalledWith('sudo', [
      'apt-get',
      'install',
      '-y',
      '-qq',
      'elide'
    ])

    expect(result.elidePath).toBe('/usr/bin/elide')
    expect(result.version.tag_name).toBe('1.0.0')
  })

  it('should map aarch64 to arm64 for apt', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'aarch64',
      version: 'latest'
    })
    await installViaApt(options)

    const teeCall = execMock.mock.calls.find(
      (call: unknown[]) =>
        call[0] === 'sudo' && (call[1] as string[])?.[0] === 'tee'
    )
    expect(teeCall).toBeDefined()
    const input = teeCall![2] as { input: Buffer }
    expect(input.input.toString()).toContain('arch=arm64')
  })

  it('should pin a specific version when requested', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.2.3'
    })
    await installViaApt(options)

    expect(execMock).toHaveBeenCalledWith('sudo', [
      'apt-get',
      'install',
      '-y',
      '-qq',
      'elide=1.2.3'
    ])
  })
})
