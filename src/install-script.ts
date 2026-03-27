import path from 'node:path'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as toolCache from '@actions/tool-cache'
import { which } from '@actions/io'
import type { ElideRelease } from './releases'
import type { ElideSetupActionOptions } from './options'
import { obtainVersion } from './command'

const installScriptUrl = 'https://dl.elide.dev/cli/install.sh'

/**
 * Install Elide via the official `elide.sh` install script.
 *
 * This path is used on macOS and non-Debian Linux where the apt repository
 * is not available.
 *
 * @param options Effective action options.
 * @return Release information for the installed binary.
 */
export async function installViaScript(
  options: ElideSetupActionOptions
): Promise<ElideRelease> {
  // Download the install script to a temp file (safer than curl | bash)
  core.info('Downloading Elide install script')
  const scriptPath = await toolCache.downloadTool(installScriptUrl)

  // Build script arguments
  const scriptArgs = [scriptPath]
  if (
    options.version &&
    options.version !== 'latest' &&
    options.version !== 'local'
  ) {
    scriptArgs.push('--version', options.version)
  }

  // Execute the install script
  core.info('Running Elide install script')
  await exec.exec('bash', scriptArgs)

  // Locate the installed binary
  let elidePath: string
  try {
    elidePath = await which('elide', true)
  } catch {
    // The install script may place the binary in ~/.elide/bin which
    // might not be on PATH yet. Try the conventional location.
    const home = process.env.HOME || process.env.USERPROFILE || '~'
    const fallbackBin = `${home}/.elide/bin`
    core.addPath(fallbackBin)
    elidePath = await which('elide', true)
  }

  const version = await obtainVersion(elidePath)
  const elideBin = path.dirname(elidePath)
  const elideHome = elideBin

  core.info(`Elide ${version} installed via script at ${elidePath}`)

  return {
    version: {
      tag_name: version,
      userProvided: options.version !== 'latest'
    },
    elidePath,
    elideHome,
    elideBin
  }
}
