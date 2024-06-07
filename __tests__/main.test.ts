import * as io from '@actions/io'
import * as core from '@actions/core'
import * as main from '../src/main'
import buildOptions, { OptionName } from '../src/options'
import { ElideArch, ElideOS } from '../src/releases'
import { ActionOutputName } from '../src/outputs'
import { resolveExistingBinary } from '../src/main'

// set timeout to 3 minutes to account for downloads
jest.setTimeout(3 * 60 * 1000)

// Mock the GitHub Actions core libs
const getInput = jest.spyOn(core, 'getInput')
const setFailed = jest.spyOn(core, 'setFailed')
const setOutput = jest.spyOn(core, 'setOutput')
const debug = jest.spyOn(core, 'debug')
const info = jest.spyOn(core, 'info')
const warning = jest.spyOn(core, 'warning')
const error = jest.spyOn(core, 'error')

const setupMocks = () => {
  debug.mockImplementation((...args) =>
    console.debug.apply(console, Array.from(args))
  )
  info.mockImplementation((...args) =>
    console.info.apply(console, Array.from(args))
  )
  warning.mockImplementation((...args) =>
    console.warn.apply(console, Array.from(args))
  )
  error.mockImplementation((...args) =>
    console.error.apply(console, Array.from(args))
  )
  setFailed.mockImplementation(() => {})
}

// Mock the action's main function
const action = jest.spyOn(main, 'run')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reads option inputs', async () => {
    setupMocks()
    await main.run()
    expect(action).toHaveReturned()
    expect(action).not.toThrow()
    expect(setFailed).not.toBeCalled()
    expect(getInput).toHaveBeenCalledWith(OptionName.VERSION)
    expect(getInput).toHaveBeenCalledWith(OptionName.OS)
    expect(getInput).toHaveBeenCalledWith(OptionName.ARCH)
    expect(getInput).toHaveBeenCalledWith(OptionName.TOKEN)
    expect(getInput).toHaveBeenCalledWith(OptionName.CUSTOM_URL)
    expect(getInput).toHaveBeenCalledWith(OptionName.EXPORT_PATH)
  })

  it('sets the `path` and `version` outputs', async () => {
    setupMocks()
    getInput.mockImplementation((name: string): string => {
      switch (name) {
        default:
          return ''
      }
    })

    await main.run()
    expect(action).toHaveReturned()
    expect(action).not.toThrow()
    expect(setFailed).not.toBeCalled()
    expect(setOutput).toHaveBeenCalledWith(
      ActionOutputName.PATH,
      expect.anything()
    )
    expect(setOutput).toHaveBeenCalledWith(
      ActionOutputName.VERSION,
      expect.anything()
    )
  })

  it('should fail for unhandled exceptions', async () => {
    setupMocks()
    info.mockImplementationOnce(() => {
      throw new Error('oh noes')
    })
    const runner = async () => {
      await main.run()
    }
    expect(runner).not.toThrow()
    expect(setFailed).toBeCalled()
  })

  it('should support downloading from a custom url', async () => {
    setupMocks()

    const sourceUrl =
      'https://elide.zip/cli/v1/snapshot/darwin-aarch64/1.0.0-alpha9/elide.tgz'
    await main.run({
      force: true,
      custom_url: sourceUrl,
      version_tag: '1.0.0-alpha9'
    })
    expect(action).toHaveReturned()
    expect(action).not.toThrow()
    expect(setFailed).not.toBeCalled()
    expect(setOutput).toHaveBeenCalledWith(
      ActionOutputName.PATH,
      expect.anything()
    )
    expect(setOutput).toHaveBeenCalledWith(
      ActionOutputName.VERSION,
      expect.anything()
    )
  })

  it('should properly detect existing elide binary', async () => {
    const which = jest.spyOn(io, 'which')
    which.mockImplementationOnce(
      async (tool: string, check?: boolean | undefined) => {
        return '/some/path/to/an/elide/bin'
      }
    )
    const existing = await resolveExistingBinary()
    expect(existing).not.toBeNull()
    expect(existing).toEqual('/some/path/to/an/elide/bin')
    jest.clearAllMocks()
  })

  it('should properly handle missing elide binary', async () => {
    const which = jest.spyOn(io, 'which')
    // @ts-ignore
    which.mockImplementationOnce(() => {
      return Promise.reject(new Error('not found (testing 123123)'))
    })
    const existing = await resolveExistingBinary()
    expect(existing).toBeNull()
    jest.clearAllMocks()
  })

  it('should be able to force installation', async () => {
    setupMocks()
    await main.run({
      force: true
    })
    expect(action).toHaveReturned()
    expect(action).not.toThrow()
    expect(setFailed).not.toBeCalled()
    expect(setOutput).toHaveBeenCalledWith(
      ActionOutputName.PATH,
      expect.anything()
    )
    expect(setOutput).toHaveBeenCalledWith(
      ActionOutputName.VERSION,
      expect.anything()
    )
  })

  it('should be able to force installation of specific version', async () => {
    setupMocks()
    await main.run({
      force: true,
      version: '1.0.0-alpha9'
    })
    expect(action).toHaveReturned()
    expect(action).not.toThrow()
    expect(setFailed).not.toBeCalled()
    expect(setOutput).toHaveBeenCalledWith(
      ActionOutputName.PATH,
      expect.anything()
    )
    expect(setOutput).toHaveBeenCalledWith(
      ActionOutputName.VERSION,
      expect.anything()
    )
  })

  const itShouldReject = (os: ElideOS, arch: ElideArch) => {
    it(`should reject ${os}/${arch} as unsupported`, async () => {
      setupMocks()
      const t = () => {
        const err = main.notSupported(
          buildOptions({
            os,
            arch
          })
        )
        if (err) throw err
      }
      expect(t).toThrowError()
      getInput.mockImplementation((name: string): string => {
        switch (name) {
          case OptionName.OS:
            return os
          case OptionName.ARCH:
            return arch
          default:
            return ''
        }
      })

      await main.run({ os, arch })
      expect(setFailed).toBeCalled()
    })
  }
  const itShouldAllow = (os: ElideOS, arch: ElideArch) => {
    it(`should allow ${os}/${arch} as supported`, () => {
      setupMocks()
      const t = () => {
        const err = main.notSupported(
          buildOptions({
            os,
            arch
          })
        )
        if (err) throw err
      }
      expect(t).not.toThrowError()
    })
  }

  // test rejected platforms
  itShouldReject(ElideOS.WINDOWS, ElideArch.AMD64)
  itShouldReject(ElideOS.WINDOWS, ElideArch.ARM64)
  itShouldReject(ElideOS.MACOS, ElideArch.AMD64)
  itShouldReject(ElideOS.LINUX, ElideArch.ARM64)

  // test allowed platforms
  itShouldAllow(ElideOS.LINUX, ElideArch.AMD64)
  itShouldAllow(ElideOS.MACOS, ElideArch.ARM64)
})
