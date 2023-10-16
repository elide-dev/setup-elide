import * as core from '@actions/core'
import * as main from '../src/main'
import buildOptions, { OptionName } from '../src/options'
import { ElideArch, ElideOS } from '../src/releases'
import { ActionOutputName } from '../src/outputs'

// set timeout to 5 minutes to account for downloads
jest.setTimeout(300 * 1000)

// Mock the GitHub Actions core library
const getInput = jest.spyOn(core, 'getInput')
const setFailed = jest.spyOn(core, 'setFailed')
const setOutput = jest.spyOn(core, 'setOutput')
const debug = jest.spyOn(core, 'debug')
const info = jest.spyOn(core, 'info')
const warning = jest.spyOn(core, 'warning')
const error = jest.spyOn(core, 'error')

const setupMockLogging = () => {
  debug.mockImplementation(() => {})
  info.mockImplementation(() => {})
  warning.mockImplementation(() => {})
  error.mockImplementation(() => {})
}

// Mock the action's main function
const action = jest.spyOn(main, 'run')

describe('action', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('reads option inputs', async () => {
    setupMockLogging()
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
    setupMockLogging()
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

  it('can force installation', async () => {
    setupMockLogging()
    getInput.mockImplementation((name: string): string => {
      switch (name) {
        case OptionName.FORCE:
          return 'true'
        default:
          return ''
      }
    })
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

  const itShouldReject = (os: ElideOS, arch: ElideArch) => {
    it(`should reject ${os}/${arch} as unsupported`, () => {
      setupMockLogging()
      const t = () => {
        const err = main.notSupported(
          buildOptions({
            os,
            arch
          })
        )
        if (err) throw err
      }
      expect(t).toThrow(Error)
    })
  }
  const itShouldAllow = (os: ElideOS, arch: ElideArch) => {
    it(`should allow ${os}/${arch} as supported`, () => {
      setupMockLogging()
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
