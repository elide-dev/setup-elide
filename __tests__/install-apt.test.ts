import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as core from '@actions/core'
import * as command from '../src/command'
import { installViaApt } from '../src/install-apt'
import buildOptions from '../src/options'

describe('install-apt', () => {
  const execSpy = jest.spyOn(exec, 'exec')
  const whichSpy = jest.spyOn(io, 'which')
  const obtainVersionSpy = jest.spyOn(command, 'obtainVersion')

  beforeEach(() => {
    jest.clearAllMocks()

    // suppress log output
    jest.spyOn(core, 'info').mockImplementation(() => {})
    jest.spyOn(core, 'debug').mockImplementation(() => {})

    // default mocks: all exec calls succeed
    execSpy.mockResolvedValue(0)
    whichSpy.mockResolvedValue('/usr/bin/elide')
    obtainVersionSpy.mockResolvedValue('1.0.0')
  })

  it('should run the correct apt commands for amd64', async () => {
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest'
    })
    const result = await installViaApt(options)

    // GPG key download
    expect(execSpy).toHaveBeenCalledWith('bash', [
      '-c',
      expect.stringContaining('keys.elide.dev/gpg.key')
    ])

    // apt source with correct arch
    expect(execSpy).toHaveBeenCalledWith(
      'sudo',
      ['tee', '/etc/apt/sources.list.d/elide.list'],
      expect.objectContaining({
        input: expect.any(Buffer)
      })
    )

    // apt-get update
    expect(execSpy).toHaveBeenCalledWith('sudo', ['apt-get', 'update', '-qq'])

    // apt-get install elide (no version pin for latest)
    expect(execSpy).toHaveBeenCalledWith('sudo', [
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

    // Check that the tee call includes arm64
    const teeCall = execSpy.mock.calls.find(
      call => call[0] === 'sudo' && call[1]?.[0] === 'tee'
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

    expect(execSpy).toHaveBeenCalledWith('sudo', [
      'apt-get',
      'install',
      '-y',
      '-qq',
      'elide=1.2.3'
    ])
  })
})
