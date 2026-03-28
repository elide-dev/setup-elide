import { describe, it, expect } from 'bun:test'
import buildOptions, {
  normalizeArch,
  normalizeOs,
  normalizeInstaller,
  validateInstallerForPlatform
} from '../src/options'

describe('action options', () => {
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
    expect(buildOptions({ os: 'mac' }).os).toEqual('darwin')
    // @ts-ignore
    expect(buildOptions({ os: 'win' }).os).toEqual('windows')
    // @ts-ignore
    expect(buildOptions({ os: 'win32' }).os).toEqual('windows')
  })
  it('should normalize the `arch` value', () => {
    // @ts-ignore
    expect(buildOptions({ arch: 'arm64' }).arch).toEqual('aarch64')
    // @ts-ignore
    expect(buildOptions({ arch: 'x64' }).arch).toEqual('amd64')
    // @ts-ignore
    expect(buildOptions({ arch: 'x86_64' }).arch).toEqual('amd64')
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
  it('should default installer to archive', () => {
    expect(buildOptions().installer).toEqual('archive')
    expect(buildOptions({}).installer).toEqual('archive')
  })
  it('should allow overriding installer', () => {
    expect(buildOptions({ installer: 'shell' }).installer).toEqual('shell')
    expect(buildOptions({ installer: 'msi' }).installer).toEqual('msi')
    expect(buildOptions({ installer: 'pkg' }).installer).toEqual('pkg')
    expect(buildOptions({ installer: 'apt' }).installer).toEqual('apt')
    expect(buildOptions({ installer: 'rpm' }).installer).toEqual('rpm')
  })
})

describe('normalizeInstaller', () => {
  it('should recognize all valid installer methods', () => {
    expect(normalizeInstaller('archive')).toEqual('archive')
    expect(normalizeInstaller('shell')).toEqual('shell')
    expect(normalizeInstaller('msi')).toEqual('msi')
    expect(normalizeInstaller('pkg')).toEqual('pkg')
    expect(normalizeInstaller('apt')).toEqual('apt')
    expect(normalizeInstaller('rpm')).toEqual('rpm')
  })
  it('should be case-insensitive', () => {
    expect(normalizeInstaller('ARCHIVE')).toEqual('archive')
    expect(normalizeInstaller('Shell')).toEqual('shell')
    expect(normalizeInstaller('MSI')).toEqual('msi')
  })
  it('should default unknown values to archive', () => {
    expect(normalizeInstaller('unknown')).toEqual('archive')
    expect(normalizeInstaller('')).toEqual('archive')
    expect(normalizeInstaller('  ')).toEqual('archive')
  })
})

describe('validateInstallerForPlatform', () => {
  it('should allow archive on any platform', () => {
    expect(validateInstallerForPlatform('archive', 'linux').valid).toBe(true)
    expect(validateInstallerForPlatform('archive', 'darwin').valid).toBe(true)
    expect(validateInstallerForPlatform('archive', 'windows').valid).toBe(true)
  })
  it('should allow shell on any platform', () => {
    expect(validateInstallerForPlatform('shell', 'linux').valid).toBe(true)
    expect(validateInstallerForPlatform('shell', 'darwin').valid).toBe(true)
    expect(validateInstallerForPlatform('shell', 'windows').valid).toBe(true)
  })
  it('should allow msi only on windows', () => {
    expect(validateInstallerForPlatform('msi', 'windows').valid).toBe(true)
    expect(validateInstallerForPlatform('msi', 'linux').valid).toBe(false)
    expect(validateInstallerForPlatform('msi', 'darwin').valid).toBe(false)
  })
  it('should allow pkg only on darwin', () => {
    expect(validateInstallerForPlatform('pkg', 'darwin').valid).toBe(true)
    expect(validateInstallerForPlatform('pkg', 'linux').valid).toBe(false)
    expect(validateInstallerForPlatform('pkg', 'windows').valid).toBe(false)
  })
  it('should allow apt only on linux', () => {
    expect(validateInstallerForPlatform('apt', 'linux').valid).toBe(true)
    expect(validateInstallerForPlatform('apt', 'darwin').valid).toBe(false)
    expect(validateInstallerForPlatform('apt', 'windows').valid).toBe(false)
  })
  it('should allow rpm only on linux', () => {
    expect(validateInstallerForPlatform('rpm', 'linux').valid).toBe(true)
    expect(validateInstallerForPlatform('rpm', 'darwin').valid).toBe(false)
    expect(validateInstallerForPlatform('rpm', 'windows').valid).toBe(false)
  })
  it('should include a reason for invalid combinations', () => {
    const result = validateInstallerForPlatform('msi', 'linux')
    expect(result.valid).toBe(false)
    expect(result.reason).toBeDefined()
    expect(result.reason).toContain('Windows')
  })
})
