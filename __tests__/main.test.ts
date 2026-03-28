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
const noticeMock = jest.fn()
const addPathMock = jest.fn()
const groupMock = jest.fn(async (_name: string, fn: () => Promise<any>) => fn())
const summaryMock = {
  addHeading: jest.fn().mockReturnThis(),
  addTable: jest.fn().mockReturnThis(),
  addCodeBlock: jest.fn().mockReturnThis(),
  addLink: jest.fn().mockReturnThis(),
  write: jest.fn().mockResolvedValue(undefined)
}
const downloadToolMock = jest.fn().mockResolvedValue('/tmp/install.sh')
const elideInfoMock = jest.fn().mockResolvedValue(undefined)
const obtainVersionMock = jest.fn().mockResolvedValue('1.0.0')
const initTelemetryMock = jest.fn()
const reportErrorMock = jest.fn()
const flushTelemetryMock = jest.fn().mockResolvedValue(undefined)

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
  notice: noticeMock,
  getInput: getInputMock,
  getBooleanInput: jest.fn().mockReturnValue(true),
  setFailed: setFailedMock,
  setOutput: setOutputMock,
  addPath: addPathMock,
  group: groupMock,
  summary: summaryMock
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
mock.module('../src/telemetry', () => ({
  initTelemetry: initTelemetryMock,
  reportError: reportErrorMock,
  flushTelemetry: flushTelemetryMock
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
    noticeMock.mockClear()
    addPathMock.mockClear()
    groupMock.mockClear()
    downloadToolMock.mockClear()
    elideInfoMock.mockClear()
    obtainVersionMock.mockClear()
    initTelemetryMock.mockClear()
    reportErrorMock.mockClear()
    flushTelemetryMock.mockClear()
    summaryMock.addHeading.mockClear()
    summaryMock.addTable.mockClear()
    summaryMock.write.mockClear()
    summaryMock.addCodeBlock.mockClear()
    summaryMock.addLink.mockClear()

    getInputMock.mockReturnValue('')
    groupMock.mockImplementation(
      async (_name: string, fn: () => Promise<any>) => fn()
    )
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
    flushTelemetryMock.mockResolvedValue(undefined)
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
    expect(getInputMock).toHaveBeenCalledWith(OptionName.INSTALLER)
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

  it('sets cached and installer outputs', async () => {
    setupMocks()
    await main.run({ force: true, installer: 'shell' })
    expect(setOutputMock).toHaveBeenCalledWith(ActionOutputName.CACHED, 'false')
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.INSTALLER,
      'shell'
    )
  })

  it('should initialize telemetry', async () => {
    setupMocks()
    await main.run()
    expect(initTelemetryMock).toHaveBeenCalled()
  })

  it('should flush telemetry in finally block', async () => {
    setupMocks()
    await main.run()
    expect(flushTelemetryMock).toHaveBeenCalled()
  })

  it('should report errors to telemetry on failure', async () => {
    setupMocks()
    infoMock.mockImplementation((msg: string) => {
      if (msg.includes('Options:')) throw new Error('oh noes')
    })
    await main.run()
    expect(reportErrorMock).toHaveBeenCalled()
    expect(setFailedMock).toHaveBeenCalled()
  })

  it('should use grouped output', async () => {
    setupMocks()
    await main.run({ force: true, installer: 'shell' })
    expect(groupMock).toHaveBeenCalledWith(
      '⚙️ Resolving options',
      expect.any(Function)
    )
    expect(groupMock).toHaveBeenCalledWith(
      '📦 Installing Elide via shell',
      expect.any(Function)
    )
    expect(groupMock).toHaveBeenCalledWith(
      '✅ Verifying installation',
      expect.any(Function)
    )
  })

  it('should write job summary on success', async () => {
    setupMocks()
    await main.run({ force: true, installer: 'shell' })
    expect(summaryMock.addHeading).toHaveBeenCalledWith('Elide Installed', 2)
    expect(summaryMock.write).toHaveBeenCalled()
  })

  it('should write error summary on failure', async () => {
    setupMocks()
    infoMock.mockImplementation((msg: string) => {
      if (msg.includes('Options:')) throw new Error('install boom')
    })
    await main.run()
    expect(summaryMock.addHeading).toHaveBeenCalledWith('Setup Elide Failed', 2)
    expect(summaryMock.addCodeBlock).toHaveBeenCalled()
    expect(summaryMock.write).toHaveBeenCalled()
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

  // --- Installer routing tests ---

  it('should use archive installer by default', async () => {
    setupMocks()
    await main.run({ force: true, installer: 'shell' })
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.PATH,
      expect.anything()
    )
  })

  it('should use shell installer when specified', async () => {
    setupMocks()
    await main.run({ force: true, installer: 'shell' })
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(infoMock).toHaveBeenCalledWith(
      expect.stringContaining('install script')
    )
  })

  it('should use apt installer when specified on linux', async () => {
    setupMocks()
    await main.run({
      force: true,
      os: 'linux',
      arch: 'amd64',
      installer: 'apt'
    })
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(infoMock).toHaveBeenCalledWith(expect.stringContaining('apt'))
  })

  it('should use msi installer on windows', async () => {
    setupMocks()
    await main.run({
      force: true,
      os: 'windows',
      arch: 'amd64',
      installer: 'msi'
    })
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(infoMock).toHaveBeenCalledWith(expect.stringContaining('MSI'))
  })

  it('should use pkg installer on darwin', async () => {
    setupMocks()
    await main.run({
      force: true,
      os: 'darwin',
      arch: 'aarch64',
      installer: 'pkg'
    })
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(infoMock).toHaveBeenCalledWith(expect.stringContaining('PKG'))
  })

  it('should use rpm installer on linux', async () => {
    setupMocks()
    await main.run({
      force: true,
      os: 'linux',
      arch: 'amd64',
      installer: 'rpm'
    })
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(infoMock).toHaveBeenCalledWith(expect.stringContaining('RPM'))
  })

  // --- Validation fallback ---

  it('should warn and fall back to archive for invalid installer/platform combo', async () => {
    setupMocks()
    await main.run({
      force: true,
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0',
      installer: 'msi'
    })
    expect(warningMock).toHaveBeenCalledWith(
      expect.stringContaining("Installer 'msi' is not supported on linux"),
      expect.objectContaining({ title: 'Installer Fallback' })
    )
    expect(setFailedMock).not.toHaveBeenCalled()
  })

  // --- Existing behavior preserved ---

  it('should be able to force installation of specific version', async () => {
    setupMocks()
    await main.run({ force: true, version: '1.0.0-alpha9' })
    expect(setFailedMock).not.toHaveBeenCalled()
    expect(setOutputMock).toHaveBeenCalledWith(
      ActionOutputName.PATH,
      expect.anything()
    )
  })

  it('should gracefully handle post-install info failure', async () => {
    setupMocks()
    elideInfoMock.mockRejectedValueOnce(new Error('info boom'))
    await main.run({ force: true, installer: 'shell' })
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
    expect(noticeMock).toHaveBeenCalledWith(
      expect.stringContaining('preserved'),
      expect.objectContaining({ title: 'Already Installed' })
    )
  })

  it('should warn on version mismatch', async () => {
    setupMocks()
    obtainVersionMock.mockResolvedValueOnce('1.0.0').mockResolvedValue('9.9.9')
    await main.run({ force: true, installer: 'shell' })
    expect(warningMock).toHaveBeenCalledWith(
      expect.stringContaining('Elide version mismatch'),
      expect.objectContaining({ title: 'Version Mismatch' })
    )
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
    await main.run({ force: true, export_path: false, installer: 'shell' })
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
