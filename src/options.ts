import os from 'node:os'
import path from 'node:path'
import * as core from '@actions/core'

/**
 * Enumerates options and maps them to their well-known option names.
 */
export enum OptionName {
  VERSION = 'version',
  CHANNEL = 'channel',
  OS = 'os',
  ARCH = 'arch',
  EXPORT_PATH = 'export_path',
  CUSTOM_URL = 'custom_url',
  VERSION_TAG = 'version_tag',
  TOKEN = 'token',
  INSTALL_PATH = 'install_path',
  FORCE = 'force',
  NO_CACHE = 'no_cache',
  INSTALLER = 'installer',
  TELEMETRY = 'telemetry'
}

/**
 * Recognized release channels.
 */
export type ElideChannel = 'nightly' | 'preview' | 'release'

/**
 * Recognized installer methods.
 */
export type InstallerMethod =
  | 'archive'
  | 'shell'
  | 'msi'
  | 'pkg'
  | 'apt'
  | 'rpm'

/**
 * Describes the interface provided by setup action configuration, once interpreted and once
 * defaults are applied.
 */
export interface ElideSetupActionOptions {
  // Desired version of Elide; the special token `latest` resolves the latest version.
  version: string | 'latest'

  // Release channel: 'nightly' (default), 'preview', or 'release'.
  channel: ElideChannel

  // Installation method: 'archive' (default), 'shell', 'msi', 'pkg', 'apt', or 'rpm'.
  installer: InstallerMethod

  // Whether to setup Elide on the PATH; defaults to `true`.
  export_path: boolean

  // Desired OS for the downloaded binary. If not provided, the current OS is resolved.
  os: 'darwin' | 'windows' | 'linux'

  // Desired arch for the downloaded binary. If not provided, the current arch is resolved.
  arch: 'amd64' | 'aarch64'

  // Directory path where Elide should be installed; if none is provided, conventional location is used for GHA.
  install_path: string

  // Whether to disable tool and action caching.
  no_cache: boolean

  // Whether to force installation if a copy of Elide is already installed.
  force: boolean

  // Custom download URL to use in place of interpreted download URLs.
  custom_url?: string

  // Version tag corresponding to a custom download URL.
  version_tag?: string

  // Custom GitHub token to use, or the workflow's default token, if any.
  token?: string

  // Whether to send anonymous error telemetry; defaults to `true`.
  telemetry: boolean
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

const defaultTargetPath =
  process.platform === 'win32' ? windowsDefaultPath : nixDefaultPath

/**
 * Defaults to apply to all instances of the Elide setup action.
 */
export const defaults: ElideSetupActionOptions = {
  version: 'latest',
  channel: 'nightly',
  installer: 'archive',
  telemetry: true,
  no_cache: false,
  export_path: true,
  force: false,
  os: normalizeOs(process.platform),
  arch: normalizeArch(process.arch),
  install_path: defaultTargetPath
}

/**
 * Normalize an installer string to a recognized installer method.
 */
export function normalizeInstaller(value: string): InstallerMethod {
  switch (value.trim().toLowerCase()) {
    case 'archive':
      return 'archive'
    case 'shell':
      return 'shell'
    case 'msi':
      return 'msi'
    case 'pkg':
      return 'pkg'
    case 'apt':
      return 'apt'
    case 'rpm':
      return 'rpm'
    default:
      return 'archive'
  }
}

/**
 * Validate that the chosen installer method is compatible with the target OS.
 * Returns `{ valid: true }` or `{ valid: false, reason: string }`.
 */
export function validateInstallerForPlatform(
  installer: InstallerMethod,
  targetOs: string
): { valid: boolean; reason?: string } {
  switch (installer) {
    case 'archive':
    case 'shell':
      return { valid: true }
    case 'msi':
      if (targetOs !== 'windows')
        return { valid: false, reason: 'MSI is only available on Windows' }
      return { valid: true }
    case 'pkg':
      if (targetOs !== 'darwin')
        return { valid: false, reason: 'PKG is only available on macOS' }
      return { valid: true }
    case 'apt':
      if (targetOs !== 'linux')
        return { valid: false, reason: 'apt is only available on Linux' }
      return { valid: true }
    case 'rpm':
      if (targetOs !== 'linux')
        return { valid: false, reason: 'RPM is only available on Linux' }
      return { valid: true }
  }
}

/**
 * Normalize a channel string to a recognized channel token.
 */
export function normalizeChannel(channel: string): ElideChannel {
  switch (channel.trim().toLowerCase()) {
    case 'nightly':
      return 'nightly'
    case 'preview':
      return 'preview'
    case 'release':
    case 'stable':
      return 'release'
    default:
      return 'nightly'
  }
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
    ...opts,
    // force-normalize the OS and arch
    os: normalizeOs(opts?.os || defaults.os),
    arch: normalizeArch(opts?.arch || defaults.arch)
  } satisfies ElideSetupActionOptions
}

const SENSITIVE_INPUT_NAMES = new Set([OptionName.TOKEN, 'secret', 'password'])

function isSensitiveInput(name: string): boolean {
  return (
    SENSITIVE_INPUT_NAMES.has(name) ||
    name.toLowerCase().includes('token') ||
    name.toLowerCase().includes('secret')
  )
}

function stringInput(name: string, defaultValue?: string): string | undefined {
  const value = core.getInput(name)
  if (isSensitiveInput(name)) {
    core.debug(
      `Input: ${name}=${value ? '<redacted>' : defaultValue ? '<redacted>' : '<empty>'}`
    )
  } else {
    core.debug(`Input: ${name}=${value || defaultValue}`)
  }
  return value || defaultValue || undefined
}

function booleanInput(name: string, defaultValue: boolean): boolean {
  try {
    return core.getBooleanInput(name)
  } catch {
    return defaultValue
  }
}

/**
 * Build action options by reading GitHub Actions inputs via core.getInput.
 */
export function buildOptionsFromInputs(): ElideSetupActionOptions {
  return buildOptions({
    version: stringInput(OptionName.VERSION, 'latest'),
    installer: normalizeInstaller(
      stringInput(OptionName.INSTALLER, 'archive') as string
    ),
    install_path: stringInput(
      OptionName.INSTALL_PATH,
      process.env.ELIDE_HOME || defaults.install_path
    ),
    os: normalizeOs(stringInput(OptionName.OS, process.platform) as string),
    arch: normalizeArch(stringInput(OptionName.ARCH, process.arch) as string),
    channel: normalizeChannel(
      stringInput(OptionName.CHANNEL, 'nightly') as string
    ),
    force: booleanInput(OptionName.FORCE, false),
    export_path: booleanInput(OptionName.EXPORT_PATH, true),
    no_cache: booleanInput(OptionName.NO_CACHE, false),
    telemetry: booleanInput(OptionName.TELEMETRY, true),
    token: stringInput(OptionName.TOKEN, process.env.GITHUB_TOKEN),
    custom_url: stringInput(OptionName.CUSTOM_URL),
    version_tag: stringInput(OptionName.VERSION_TAG)
  })
}
