import path from 'node:path'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as toolCache from '@actions/tool-cache'
import { which } from '@actions/io'
import type { ElideRelease } from './releases'
import type { ElideSetupActionOptions } from './options'
import { obtainVersion } from './command'

const bashScriptUrl = 'https://dl.elide.dev/cli/install.sh'
const powershellScriptUrl = 'https://dl.elide.dev/cli/install.ps1'

/**
 * Install Elide via the official install scripts.
 *
 * - Linux/macOS: downloads `install.sh` and runs with `bash ... --gha`
 * - Windows: downloads `install.ps1` and runs with `powershell ... -Gha`
 *
 * The `--gha` / `-Gha` flags ensure the scripts route downloads through
 * GitHub Releases for faster performance in GitHub Actions.
 *
 * @param options Effective action options.
 * @return Release information for the installed binary.
 */
export async function installViaShell(
  options: ElideSetupActionOptions
): Promise<ElideRelease> {
  if (options.os === 'windows') {
    return installViaPowerShell(options)
  }
  return installViaBash(options)
}

async function installViaBash(
  options: ElideSetupActionOptions
): Promise<ElideRelease> {
  core.info('Downloading Elide install script (bash)')
  const scriptPath = await toolCache.downloadTool(bashScriptUrl)

  const scriptArgs = [scriptPath, '--gha']
  if (
    options.version &&
    options.version !== 'latest' &&
    options.version !== 'local'
  ) {
    scriptArgs.push('--version', options.version)
  }

  core.info('Running Elide install script')
  await exec.exec('bash', scriptArgs)

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

  core.info(`Elide ${version} installed via bash script at ${elidePath}`)

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

async function installViaPowerShell(
  options: ElideSetupActionOptions
): Promise<ElideRelease> {
  core.info('Downloading Elide install script (PowerShell)')
  const scriptPath = await toolCache.downloadTool(powershellScriptUrl)

  const psArgs = ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Gha']
  if (
    options.version &&
    options.version !== 'latest' &&
    options.version !== 'local'
  ) {
    psArgs.push('-Version', options.version)
  }

  core.info('Running Elide install script (PowerShell)')
  await exec.exec('powershell', psArgs)

  const elidePath = await which('elide', true)
  const version = await obtainVersion(elidePath)
  const elideBin = path.dirname(elidePath)
  const elideHome = elideBin

  core.info(`Elide ${version} installed via PowerShell script at ${elidePath}`)

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
