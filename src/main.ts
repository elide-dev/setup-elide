import * as core from '@actions/core'
import * as io from '@actions/io'
import { elideInfo, obtainVersion } from './command'

/**
 * Enumerates outputs and maps them to their well-known names.
 */
export enum ActionOutputName {
  PATH = 'path',
  VERSION = 'version'
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
      core.error(`Platform is not supported: ${spec}`)
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
    // ignore: no existing copy
    return null
  }
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(
  options?: Partial<ElideSetupActionOptions>
): Promise<void> {
  try {
    core.info('Installing Elide with GitHub Actions')
    const effectiveOptions: ElideSetupActionOptions = options
      ? buildOptions(options)
      : buildOptionsFromInputs()

    // make sure the requested version, platform, and os triple is supported
    const supportErr = notSupported(effectiveOptions)
    if (supportErr) {
      core.setFailed(supportErr.message)
      return
    }

    // if elide is already installed and the user didn't set `force`, we can bail
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
          core.info(
            `Existing Elide installation at version '${version}' was preserved`
          )
          core.setOutput(ActionOutputName.PATH, existing)
          core.setOutput(ActionOutputName.VERSION, version)
          return
        }
      }
    }

    // validate installer for platform, fall back to archive with warning
    let installer = effectiveOptions.installer
    const validation = validateInstallerForPlatform(
      installer,
      effectiveOptions.os
    )
    if (!validation.valid) {
      core.warning(
        `Installer '${installer}' is not supported on ${effectiveOptions.os}: ${validation.reason}. Falling back to 'archive'.`
      )
      installer = 'archive'
    }

    // choose installation method
    let release: ElideRelease
    if (effectiveOptions.custom_url) {
      release = await downloadRelease(effectiveOptions)
    } else {
      switch (installer) {
        case 'archive':
          release = await downloadRelease(effectiveOptions)
          break
        case 'shell':
          release = await installViaShell(effectiveOptions)
          break
        case 'msi':
          release = await installViaMsi(effectiveOptions)
          break
        case 'pkg':
          release = await installViaPkg(effectiveOptions)
          break
        case 'apt':
          release = await installViaApt(effectiveOptions)
          break
        case 'rpm':
          release = await installViaRpm(effectiveOptions)
          break
      }
    }
    core.debug(`Release version: '${release.version.tag_name}'`)

    // if instructed, add Elide to the path
    if (effectiveOptions.export_path) {
      core.info(`Adding '${release.elideBin}' to PATH`)
      core.addPath(release.elideBin)
    }

    // verify installed version
    await postInstall(release.elidePath)
    const version = await obtainVersion(release.elidePath)

    const isNightly = release.version.tag_name.startsWith('nightly-')
    if (!isNightly && version !== release.version.tag_name) {
      core.warning(
        `Elide version mismatch: expected '${release.version.tag_name}', but got '${version}'`
      )
    }

    // set outputs
    core.setOutput(ActionOutputName.PATH, release.elidePath)
    core.setOutput(ActionOutputName.VERSION, version)
    core.info(`Elide installed at version ${release.version.tag_name}`)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
