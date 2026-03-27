import * as exec from '@actions/exec'
import * as io from '@actions/io'
import * as core from '@actions/core'
import * as toolCache from '@actions/tool-cache'
import * as command from '../src/command'
import { installViaScript } from '../src/install-script'
import buildOptions from '../src/options'

describe('install-script', () => {
  const execSpy = jest.spyOn(exec, 'exec')
  const whichSpy = jest.spyOn(io, 'which')
  const downloadToolSpy = jest.spyOn(toolCache, 'downloadTool')
  const obtainVersionSpy = jest.spyOn(command, 'obtainVersion')
  const addPathSpy = jest.spyOn(core, 'addPath')

  beforeEach(() => {
    jest.clearAllMocks()

    // suppress log output
    jest.spyOn(core, 'info').mockImplementation(() => {})
    jest.spyOn(core, 'debug').mockImplementation(() => {})

    // default mocks
    downloadToolSpy.mockResolvedValue('/tmp/install.sh')
    execSpy.mockResolvedValue(0)
    whichSpy.mockResolvedValue('/usr/local/bin/elide')
    obtainVersionSpy.mockResolvedValue('1.0.0')
  })

  it('should download and execute the install script', async () => {
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: 'latest'
    })
    const result = await installViaScript(options)

    expect(downloadToolSpy).toHaveBeenCalledWith(
      'https://dl.elide.dev/cli/install.sh'
    )
    expect(execSpy).toHaveBeenCalledWith('bash', ['/tmp/install.sh'])
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

    expect(execSpy).toHaveBeenCalledWith('bash', [
      '/tmp/install.sh',
      '--version',
      '1.2.3'
    ])
  })

  it('should fall back to ~/.elide/bin if which fails initially', async () => {
    whichSpy
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce('/home/runner/.elide/bin/elide')

    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest'
    })
    const result = await installViaScript(options)

    expect(addPathSpy).toHaveBeenCalled()
    expect(result.elidePath).toBe('/home/runner/.elide/bin/elide')
  })
})
