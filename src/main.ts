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
  buildOptionsFromInputs
} from './options'

import { downloadRelease, ElideRelease } from './releases'
import { isDebianLike } from './platform'
import { installViaApt } from './install-apt'
import { installViaScript } from './install-script'

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

    // choose installation method based on platform
    let release: ElideRelease
    if (effectiveOptions.custom_url) {
      // custom URL always uses the tarball download path
      release = await downloadRelease(effectiveOptions)
    } else if (effectiveOptions.os === 'linux' && (await isDebianLike())) {
      core.info('Detected Debian/Ubuntu -- installing via apt repository')
      release = await installViaApt(effectiveOptions)
    } else if (effectiveOptions.os === 'windows') {
      core.info('Detected Windows -- installing via archive download')
      release = await downloadRelease(effectiveOptions)
    } else if (
      effectiveOptions.os === 'linux' ||
      effectiveOptions.os === 'darwin'
    ) {
      core.info('Installing via install script')
      release = await installViaScript(effectiveOptions)
    } else {
      // Unknown platform: fall back to archive download
      release = await downloadRelease(effectiveOptions)
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
