import * as core from '@actions/core'
import * as io from '@actions/io'
import { elideInfo, obtainVersion } from './command'
import { initTelemetry, reportError, flushTelemetry } from './telemetry'

/**
 * Enumerates outputs and maps them to their well-known names.
 */
export enum ActionOutputName {
  PATH = 'path',
  VERSION = 'version',
  CACHED = 'cached',
  INSTALLER = 'installer'
}

import buildOptions, {
  ElideSetupActionOptions,
  buildOptionsFromInputs,
  validateInstallerForPlatform
} from './options'

import { downloadRelease, ElideRelease } from './releases'
import { installViaApt } from './install-apt'
import { installViaShell } from './install-shell'
import { installViaMsi } from './install-msi'
import { installViaPkg } from './install-pkg'
import { installViaRpm } from './install-rpm'

export function notSupported(options: ElideSetupActionOptions): null | Error {
  const spec = `${options.os}-${options.arch}`
  switch (spec) {
    case 'linux-amd64':
    case 'linux-aarch64':
    case 'darwin-aarch64':
    case 'darwin-amd64':
    case 'windows-amd64':
      return null
    default:
      return new Error(`Platform not supported: ${spec}`)
  }
}

export async function postInstall(bin: string): Promise<void> {
  try {
    await elideInfo(bin)
  } catch (err) {
    core.debug(
      `Post-install info failed; proceeding anyway. Error: ${err instanceof Error ? err.message : err}`
    )
  }
}

export async function resolveExistingBinary(): Promise<string | null> {
  try {
    return await io.which('elide', true)
  } catch {
    return null
  }
}

async function writeSummary(
  version: string,
  options: ElideSetupActionOptions,
  installer: string,
  elidePath: string,
  cached: boolean,
  elapsedMs: number
): Promise<void> {
  try {
    const elapsed =
      elapsedMs < 1000
        ? `${Math.round(elapsedMs)}ms`
        : `${(elapsedMs / 1000).toFixed(1)}s`

    await core.summary
      .addHeading('Elide Installed', 2)
      .addTable([
        [
          { data: 'Version', header: true },
          { data: version, header: false }
        ],
        [
          { data: 'Channel', header: true },
          { data: options.channel, header: false }
        ],
        [
          { data: 'Installer', header: true },
          { data: installer, header: false }
        ],
        [
          { data: 'Platform', header: true },
          { data: `${options.os}-${options.arch}`, header: false }
        ],
        [
          { data: 'Path', header: true },
          { data: elidePath, header: false }
        ],
        [
          { data: 'Cached', header: true },
          { data: cached ? 'yes' : 'no', header: false }
        ],
        [
          { data: 'Time', header: true },
          { data: elapsed, header: false }
        ]
      ])
      .write()
  } catch {
    // Summary writes can fail in non-GHA environments; ignore
  }
}

async function writeErrorSummary(error: Error): Promise<void> {
  try {
    await core.summary
      .addHeading('Setup Elide Failed', 2)
      .addCodeBlock(error.message, 'text')
      .addLink(
        'Report this issue',
        'https://github.com/elide-dev/setup-elide/issues/new'
      )
      .write()
  } catch {
    // ignore
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(
  options?: Partial<ElideSetupActionOptions>
): Promise<void> {
  const startTime = Date.now()

  try {
    // --- Resolve options ---
    const effectiveOptions: ElideSetupActionOptions = await core.group(
      '⚙️ Resolving options',
      async () => {
        const opts = options ? buildOptions(options) : buildOptionsFromInputs()
        core.info(
          `Options: version=${opts.version} channel=${opts.channel} installer=${opts.installer} os=${opts.os} arch=${opts.arch}`
        )
        return opts
      }
    )

    // Init telemetry early so errors during install are captured
    initTelemetry(effectiveOptions.telemetry, effectiveOptions)

    // --- Validate platform ---
    const supportErr = notSupported(effectiveOptions)
    if (supportErr) {
      core.error(supportErr.message, { title: 'Platform Not Supported' })
      core.setFailed(supportErr.message)
      return
    }

    // --- Check for existing binary ---
    if (!effectiveOptions.force) {
      const existing: string | null = await resolveExistingBinary()
      if (existing) {
        core.debug(
          `Located existing Elide binary at: '${existing}'. Obtaining version...`
        )
        await postInstall(existing)
        const version = await obtainVersion(existing)

        if (
          version === effectiveOptions.version ||
          effectiveOptions.version === 'local'
        ) {
          core.notice(`Existing Elide ${version} preserved at ${existing}`, {
            title: 'Already Installed'
          })
          core.setOutput(ActionOutputName.PATH, existing)
          core.setOutput(ActionOutputName.VERSION, version)
          core.setOutput(ActionOutputName.CACHED, 'true')
          core.setOutput(ActionOutputName.INSTALLER, 'none')
          return
        }
      }
    }

    // --- Validate installer for platform ---
    let installer = effectiveOptions.installer
    const validation = validateInstallerForPlatform(
      installer,
      effectiveOptions.os
    )
    if (!validation.valid) {
      core.warning(
        `Installer '${installer}' is not supported on ${effectiveOptions.os}: ${validation.reason}. Falling back to 'archive'.`,
        { title: 'Installer Fallback' }
      )
      installer = 'archive'
    }

    // --- Install ---
    const release: ElideRelease = await core.group(
      `📦 Installing Elide via ${installer}`,
      async () => {
        if (effectiveOptions.custom_url) {
          core.info(`Using custom URL: ${effectiveOptions.custom_url}`)
          return downloadRelease(effectiveOptions)
        }

        switch (installer) {
          case 'archive':
            return downloadRelease(effectiveOptions)
          case 'shell':
            return installViaShell(effectiveOptions)
          case 'msi':
            return installViaMsi(effectiveOptions)
          case 'pkg':
            return installViaPkg(effectiveOptions)
          case 'apt':
            return installViaApt(effectiveOptions)
          case 'rpm':
            return installViaRpm(effectiveOptions)
        }
      }
    )
    core.debug(`Release version: '${release.version.tag_name}'`)

    // --- Post-install ---
    const version: string = await core.group(
      '✅ Verifying installation',
      async () => {
        if (effectiveOptions.export_path) {
          core.info(`Adding '${release.elideBin}' to PATH`)
          core.addPath(release.elideBin)
        }

        await postInstall(release.elidePath)
        const ver = await obtainVersion(release.elidePath)

        const isNightly = release.version.tag_name.startsWith('nightly-')
        if (!isNightly && ver !== release.version.tag_name) {
          core.warning(
            `Elide version mismatch: expected '${release.version.tag_name}', but got '${ver}'`,
            { title: 'Version Mismatch' }
          )
        }

        return ver
      }
    )

    // --- Set outputs ---
    const cached = release.cached ?? false
    core.setOutput(ActionOutputName.PATH, release.elidePath)
    core.setOutput(ActionOutputName.VERSION, version)
    core.setOutput(ActionOutputName.CACHED, cached ? 'true' : 'false')
    core.setOutput(ActionOutputName.INSTALLER, installer)

    if (cached) {
      core.notice(`Using cached Elide ${release.version.tag_name}`, {
        title: 'Cache Hit'
      })
    }

    const elapsed = Date.now() - startTime
    core.info(
      `Elide ${release.version.tag_name} installed in ${elapsed < 1000 ? `${elapsed}ms` : `${(elapsed / 1000).toFixed(1)}s`}`
    )

    await writeSummary(
      version,
      effectiveOptions,
      installer,
      release.elidePath,
      cached,
      elapsed
    )
  } catch (error) {
    if (error instanceof Error) {
      reportError(error)
      core.error(error.message, { title: 'Installation Failed' })
      core.setFailed(error.message)
      await writeErrorSummary(error)
    }
  } finally {
    await flushTelemetry()
  }
}
