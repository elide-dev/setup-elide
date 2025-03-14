import os from 'node:os'
import path from 'node:path'

/**
 * Enumerates options and maps them to their well-known option names.
 */
export enum OptionName {
  VERSION = 'version',
  OS = 'os',
  ARCH = 'arch',
  EXPORT_PATH = 'export_path',
  CUSTOM_URL = 'custom_url',
  VERSION_TAG = 'version_tag',
  TOKEN = 'token',
  TARGET = 'target',
  FORCE = 'force'
}

/**
 * Describes the interface provided by setup action configuration, once interpreted and once
 * defaults are applied.
 */
export interface ElideSetupActionOptions {
  // Desired version of Elide; the special token `latest` resolves the latest version.
  version: string | 'latest'

  // Whether to setup Elide on the PATH; defaults to `true`.
  export_path: boolean

  // Desired OS for the downloaded binary. If not provided, the current OS is resolved.
  os: 'darwin' | 'windows' | 'linux'

  // Desired arch for the downloaded binary. If not provided, the current arch is resolved.
  arch: 'amd64' | 'aarch64'

  // Directory path where Elide should be installed; if none is provided, `~/elide` is used.
  target: string

  // Whether to leverage tool and action caching.
  cache: boolean

  // Whether to force installation if a copy of Elide is already installed.
  force: boolean

  // Whether to pre-warm the installed copy of Elide; defaults to `true`.
  prewarm: boolean

  // Custom download URL to use in place of interpreted download URLs.
  custom_url?: string

  // Version tag corresponding to a custom download URL.
  version_tag?: string

  // Custom GitHub token to use, or the workflow's default token, if any.
  token?: string
}

/**
 * Default install prefix on Windows.
 */
export const windowsDefaultPath = 'C:\\Elide'

/**
 * Default install prefix on macOS and Linux.
 */
export const nixDefaultPath = path.resolve(os.homedir(), 'elide')

/**
 * Default Elide configurations path on all platforms.
 */
export const configPath = path.resolve(os.homedir(), '.elide')

/* istanbul ignore next */
const defaultTarget =
  process.platform === 'win32' ? windowsDefaultPath : nixDefaultPath

/**
 * Defaults to apply to all instances of the Elide setup action.
 */
export const defaults: ElideSetupActionOptions = {
  version: 'latest',
  cache: true,
  export_path: true,
  force: false,
  prewarm: true,
  os: normalizeOs(process.platform),
  arch: normalizeArch(process.arch),
  target: defaultTarget
}

/**
 * Normalize the provided OS name or token into a recognized token.
 *
 * @param os Operating system name or token.
 * @return Normalized OS name.
 */
export function normalizeOs(os: string): 'darwin' | 'windows' | 'linux' {
  switch (os.trim().toLowerCase()) {
    case 'macos':
      return 'darwin'
    case 'mac':
      return 'darwin'
    case 'darwin':
      return 'darwin'
    case 'windows':
      return 'windows'
    case 'win':
      return 'windows'
    case 'win32':
      return 'windows'
    case 'linux':
      return 'linux'
  }
  /* istanbul ignore next */
  throw new Error(`Unrecognized OS: ${os}`)
}

/**
 * Normalize the provided architecture name or token into a recognized token.
 *
 * @param arch Architecture name or token.
 * @return Normalized architecture.
 */
export function normalizeArch(arch: string): 'amd64' | 'aarch64' {
  switch (arch.trim().toLowerCase()) {
    case 'x64':
      return 'amd64'
    case 'amd64':
      return 'amd64'
    case 'x86_64':
      return 'amd64'
    case 'aarch64':
      return 'aarch64'
    case 'arm64':
      return 'aarch64'
  }
  /* istanbul ignore next */
  throw new Error(`Unrecognized architecture: ${arch}`)
}

/**
 * Build a suite of action options from defaults and overrides provided by the user.
 *
 * @param opts Override options provided by the user.
 * @return Merged set of applicable options.
 */
export default function buildOptions(
  opts?: Partial<ElideSetupActionOptions>
): ElideSetupActionOptions {
  return {
    ...defaults,
    ...(opts || {}),
    ...{
      // force-normalize the OS and arch
      os: normalizeOs(opts?.os || defaults.os),
      arch: normalizeArch(opts?.arch || defaults.arch)
    }
  } satisfies ElideSetupActionOptions
}
