import { describe, it, expect, beforeEach, jest, mock } from 'bun:test'

// Create mock functions
const execMock = jest.fn().mockResolvedValue(0)
const getExecOutputMock = jest
  .fn()
  .mockResolvedValue({ stdout: '1.0.0\n', stderr: '', exitCode: 0 })
const whichMock = jest.fn()
const getInputMock = jest.fn().mockReturnValue('')
const setFailedMock = jest.fn()
const setOutputMock = jest.fn()
const debugMock = jest.fn()
const infoMock = jest.fn()
const warningMock = jest.fn()
const errorMock = jest.fn()
const addPathMock = jest.fn()
const isDebianLikeMock = jest.fn().mockResolvedValue(false)
const downloadToolMock = jest.fn().mockResolvedValue('/tmp/install.sh')
const elideInfoMock = jest.fn().mockResolvedValue(undefined)
const obtainVersionMock = jest.fn().mockResolvedValue('1.0.0')

// Mock modules before any project imports
mock.module('@actions/exec', () => ({
  exec: execMock,
  getExecOutput: getExecOutputMock
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
  error: errorMock,
  warning: warningMock,
  getInput: getInputMock,
  getBooleanInput: jest.fn().mockReturnValue(true),
  setFailed: setFailedMock,
  setOutput: setOutputMock,
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
  elideInfo: elideInfoMock,
  obtainVersion: obtainVersionMock,
  ElideCommand: { RUN: 'run', INFO: 'info' },
  ElideArgument: { VERSION: '--version' }
}))
mock.module('../src/platform', () => ({
  isDebianLike: isDebianLikeMock
}))

const main = await import('../src/main')
const { default: buildOptions, OptionName } = await import('../src/options')
const { ElideArch, ElideOS } = await import('../src/releases')
const { ActionOutputName } = await import('../src/main')

const setupMocks = () => {
  debugMock.mockImplementation((...args: unknown[]) =>
    console.debug.apply(console, Array.from(args))
  )
  infoMock.mockImplementation((...args: unknown[]) =>
    console.info.apply(console, Array.from(args))
  )
  warningMock.mockImplementation((...args: unknown[]) =>
    console.warn.apply(console, Array.from(args))
  )
  errorMock.mockImplementation((...args: unknown[]) =>
    console.error.apply(console, Array.from(args))
  )
  setFailedMock.mockImplementation(() => {})
}

describe('action', () => {
  beforeEach(() => {
    // Clear all mock state
    execMock.mockClear()
    getExecOutputMock.mockClear()
    whichMock.mockClear()
    getInputMock.mockClear()
    setFailedMock.mockClear()
    setOutputMock.mockClear()
    debugMock.mockClear()
    infoMock.mockClear()
    warningMock.mockClear()
    errorMock.mockClear()
    addPathMock.mockClear()
    isDebianLikeMock.mockClear()
    downloadToolMock.mockClear()
    elideInfoMock.mockClear()
    obtainVersionMock.mockClear()
    // Default: getInput returns empty
    getInputMock.mockReturnValue('')

    // Default: not debian
    isDebianLikeMock.mockResolvedValue(false)

    // Default: install script path succeeds
    downloadToolMock.mockResolvedValue('/tmp/install.sh')
    execMock.mockResolvedValue(0)
    whichMock.mockResolvedValue('/mock/bin/elide')
    getExecOutputMock.mockResolvedValue({
      stdout: '1.0.0\n',
      stderr: '',
      exitCode: 0
    })
    elideInfoMock.mockResolvedValue(undefined)
    obtainVersionMock.mockResolvedValue('1.0.0')
  })

  it('reads option inputs', async () => {
    setupMocks()
    await main.run()
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(getInputMock).toHaveBeenCalledWith(OptionName.VERSION)
    expect(getInputMock).toHaveBeenCalledWith(OptionName.OS)
    expect(getInputMock).toHaveBeenCalledWith(OptionName.ARCH)
    expect(getInputMock).toHaveBeenCalledWith(OptionName.TOKEN)
    expect(getInputMock).toHaveBeenCalledWith(OptionName.CUSTOM_URL)
  })

  it('sets the `path` and `version` outputs', async () => {
    setupMocks()
    await main.run()
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.PATH,
      expect.anything()
    )
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.VERSION,
      expect.anything()
    )
  })

  it('should fail for unhandled exceptions', async () => {
    setupMocks()
    infoMock.mockImplementationOnce(() => {
      throw new Error('oh noes')
    })
    await main.run()
    expect(setFailedMock).toHaveBeenCalled()
  })

  it('should properly detect existing elide binary', async () => {
    whichMock.mockResolvedValueOnce('/some/path/to/an/elide/bin')
    const existing = await main.resolveExistingBinary()
    expect(existing).not.toBeNull()
    expect(existing).toEqual('/some/path/to/an/elide/bin')
  })

  it('should properly handle missing elide binary', async () => {
    whichMock.mockRejectedValueOnce(new Error('not found'))
    const existing = await main.resolveExistingBinary()
    expect(existing).toBeNull()
  })

  it('should be able to force installation', async () => {
    setupMocks()
    await main.run({ force: true })
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.PATH,
      expect.anything()
    )
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.VERSION,
      expect.anything()
    )
  })

  it('should be able to force installation of specific version', async () => {
    setupMocks()
    await main.run({ force: true, version: '1.0.0-alpha9' })
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.PATH,
      expect.anything()
    )
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.VERSION,
      expect.anything()
    )
  })

  it('should gracefully handle post-install info failure', async () => {
    setupMocks()
    elideInfoMock.mockRejectedValueOnce(new Error('info boom'))
    await main.run({ force: true })
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(debugMock).toHaveBeenCalledWith(
      expect.stringContaining('Post-install info failed; proceeding anyway')
    )
  })

  it('should preserve existing binary when version matches "local"', async () => {
    setupMocks()
    whichMock.mockResolvedValue('/existing/elide')
    obtainVersionMock.mockResolvedValue('1.0.0')
    await main.run({ version: 'local' })
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.PATH,
      '/existing/elide'
    )
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.VERSION,
      '1.0.0'
    )
    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining('was preserved')
    )
  })

  it('should install via apt when on debian-like linux', async () => {
    setupMocks()
    isDebianLikeMock.mockResolvedValue(true)
    await main.run({ force: true, os: 'linux', arch: 'amd64' })
    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining('apt repository')
    )
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('should warn on version mismatch', async () => {
    setupMocks()
    // First call (inside installViaScript) returns the "installed" version,
    // second call (main.run verification) returns a different version.
    obtainVersionMock.mockResolvedValueOnce('1.0.0').mockResolvedValue('9.9.9')
    await main.run({ force: true })
    expect(warningMock).toHaveBeenCalledWith(
      expect.stringContaining('Elide version mismatch')
    )
  })

  it('should use archive download for windows', async () => {
    setupMocks()
    await main.run({ force: true, os: 'windows', arch: 'amd64' })
    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining('Windows -- installing via archive')
    )
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('should use downloadRelease for custom_url', async () => {
    setupMocks()
    downloadToolMock.mockResolvedValue('/tmp/custom-elide.tgz')
    await main.run({
      force: true,
      custom_url: 'https://example.com/elide.tgz',
      version_tag: '1.0.0-custom'
    })
    expect(downloadToolMock).toHaveBeenCalledWith(
      'https://example.com/elide.tgz'
    )
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  it('should not export to path when export_path is false', async () => {
    setupMocks()
    await main.run({ force: true, export_path: false })
    expect(addPathMock).not.toHaveBeenCalled()
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  const itShouldReject = (os: string, arch: string) => {
    it(`should reject ${os}/${arch} as unsupported`, async () => {
      setupMocks()
      const t = () => {
        const err = main.notSupported(buildOptions({ os, arch } as any))
        if (err) throw err
      }
      expect(t).toThrow()
      getInputMock.mockImplementation((name: string): string => {
        switch (name) {
          case OptionName.OS:
            return os
          case OptionName.ARCH:
            return arch
          default:
            return ''
        }
      })
      await main.run({ os, arch } as any)
      expect(setFailedMock).toHaveBeenCalled()
    })
  }
  const itShouldAllow = (os: string, arch: string) => {
    it(`should allow ${os}/${arch} as supported`, () => {
      setupMocks()
      const t = () => {
        const err = main.notSupported(buildOptions({ os, arch } as any))
        if (err) throw err
      }
      expect(t).not.toThrow()
    })
  }

  // test rejected platforms
  itShouldReject(ElideOS.WINDOWS, ElideArch.ARM64)

  // test allowed platforms
  itShouldAllow(ElideOS.LINUX, ElideArch.AMD64)
  itShouldAllow(ElideOS.MACOS, ElideArch.ARM64)
  itShouldAllow(ElideOS.MACOS, ElideArch.AMD64)
  itShouldAllow(ElideOS.WINDOWS, ElideArch.AMD64)
})
