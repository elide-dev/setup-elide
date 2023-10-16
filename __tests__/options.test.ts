import buildOptions, { normalizeArch, normalizeOs } from '../src/options'

describe('action options', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should apply sensible defaults', () => {
    expect(buildOptions()).not.toBeNull()
    expect(buildOptions({})).not.toBeNull()
    expect(buildOptions().os).toEqual(normalizeOs(process.platform))
    expect(buildOptions({}).os).toEqual(normalizeOs(process.platform))
    expect(buildOptions().arch).toEqual(normalizeArch(process.arch))
    expect(buildOptions({}).arch).toEqual(normalizeArch(process.arch))
  })
  it('should allow overriding the `os` or `arch`', () => {
    expect(buildOptions({ os: 'darwin' }).os).toEqual('darwin')
    expect(buildOptions({ os: 'windows' }).os).toEqual('windows')
    expect(buildOptions({ os: 'linux' }).os).toEqual('linux')
    expect(buildOptions({ arch: 'amd64' }).arch).toEqual('amd64')
    expect(buildOptions({ arch: 'aarch64' }).arch).toEqual('aarch64')
  })
  it('should normalize the `os` value', () => {
    // @ts-ignore
    expect(buildOptions({ os: 'macos' }).os).toEqual('darwin')
    // @ts-ignore
    expect(buildOptions({ os: 'win' }).os).toEqual('windows')
  })
  it('should normalize the `arch` value', () => {
    // @ts-ignore
    expect(buildOptions({ arch: 'arm64' }).arch).toEqual('aarch64')
    // @ts-ignore
    expect(buildOptions({ arch: 'x64' }).arch).toEqual('amd64')
  })
  it('should allow overriding with custom `version`', () => {
    expect(buildOptions().version).toEqual('latest')
    expect(buildOptions({}).version).toEqual('latest')
    expect(buildOptions({ version: 'test' }).version).toEqual('test')
  })
  it('should export to the PATH unless otherwise directed', () => {
    expect(buildOptions().export_path).toBeTruthy()
    expect(buildOptions({}).export_path).toBeTruthy()
    expect(buildOptions({ export_path: true }).export_path).toBeTruthy()
    expect(buildOptions({ export_path: false }).export_path).toBeFalsy()
  })
})
