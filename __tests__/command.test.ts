import { describe, it, expect, beforeEach, jest, mock } from 'bun:test'

const execMock = jest.fn().mockResolvedValue(0)
const getExecOutputMock = jest
  .fn()
  .mockResolvedValue({ stdout: '1.0.0\n', stderr: '', exitCode: 0 })
const debugMock = jest.fn()
const infoMock = jest.fn()

mock.module('@actions/exec', () => ({
  exec: execMock,
  getExecOutput: getExecOutputMock
}))
mock.module('@actions/core', () => ({
  debug: debugMock,
  info: infoMock,
  error: jest.fn(),
  warning: jest.fn(),
  getInput: jest.fn().mockReturnValue(''),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  addPath: jest.fn()
}))

const { prewarm, info, obtainVersion, ElideCommand, ElideArgument } =
  await import('../src/command')

describe('command', () => {
  beforeEach(() => {
    execMock.mockClear()
    getExecOutputMock.mockClear()
    debugMock.mockClear()
    infoMock.mockClear()
    execMock.mockResolvedValue(0)
    getExecOutputMock.mockResolvedValue({
      stdout: '1.0.0\n',
      stderr: '',
      exitCode: 0
    })
  })

  it('prewarm should execute the info command', async () => {
    await prewarm('/usr/bin/elide')
    expect(infoMock).toHaveBeenCalledWith(
      'Prewarming Elide at bin: /usr/bin/elide'
    )
    expect(execMock).toHaveBeenCalledWith('"/usr/bin/elide"', [
      ElideCommand.INFO
    ])
  })

  it('info should execute the info command', async () => {
    await info('/usr/bin/elide')
    expect(debugMock).toHaveBeenCalledWith(
      'Printing runtime info at bin: /usr/bin/elide'
    )
    expect(execMock).toHaveBeenCalledWith('"/usr/bin/elide"', [
      ElideCommand.INFO
    ])
  })

  it('obtainVersion should return trimmed version string', async () => {
    getExecOutputMock.mockResolvedValue({
      stdout: '  1.2.3\n',
      stderr: '',
      exitCode: 0
    })
    const version = await obtainVersion('/usr/bin/elide')
    expect(version).toBe('1.2.3')
    expect(getExecOutputMock).toHaveBeenCalledWith('"/usr/bin/elide"', [
      ElideArgument.VERSION
    ])
  })

  it('obtainVersion should strip %0A markers', async () => {
    getExecOutputMock.mockResolvedValue({
      stdout: '1.0.0%0A',
      stderr: '',
      exitCode: 0
    })
    const version = await obtainVersion('/usr/bin/elide')
    expect(version).toBe('1.0.0')
  })

  it('prewarm should propagate exec errors', async () => {
    execMock.mockRejectedValue(new Error('exec failed'))
    await expect(prewarm('/bad/path')).rejects.toThrow('exec failed')
  })
})
