/**
 * Enumerates options and maps them to their well-known option names.
 */
export enum OptionName {
  VERSION = 'version',
  OS = 'os',
  ARCH = 'arch',
  EXPORT_PATH = 'export_path',
  CUSTOM_URL = 'custom_url',
  TOKEN = 'token'
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
  os: string

  // Desired arch for the downloaded binary. If not provided, the current arch is resolved.
  arch: string

  // Whether to leverage tool and action caching.
  cache: boolean

  // Custom download URL to use in place of interpreted download URLs.
  custom_url?: string

  // Custom GitHub token to use, or the workflow's default token, if any.
  token?: string
}

/**
 * Defaults to apply to all instances of the Elide setup action.
 */
export const defaults: ElideSetupActionOptions = {
  version: 'latest',
  cache: true,
  export_path: true,
  os: process.platform,
  arch: process.arch
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
    ...(opts || {})
  } satisfies ElideSetupActionOptions
}
