import * as core from '@actions/core'
import * as exec from '@actions/exec'

async function execElide(bin: string, args?: string[]): Promise<void> {
  core.debug(`Executing: bin=${bin}, args=${args}`)
  await exec.exec(`"${bin}"`, args)
}

/**
 * Enumerates available commands which can be run in Elide.
 */
export enum ElideCommand {
  // Run some code.
  RUN = 'run',

  // Print runtime environment info.
  INFO = 'info',

  // Run the embedded self-test suite.
  SELFTEST = 'selftest'
}

/**
 * Enumerates well-known arguments that can be passed to Elide.
 */
export enum ElideArgument {
  VERSION = '--version'
}

/**
 * Prewarm the provided Elide binary by running a small script.
 *
 * @param bin Path to the Elide binary.
 * @return Promise which resolves when finished.
 */
export async function prewarm(bin: string): Promise<void> {
  core.info(`Prewarming Elide at bin: ${bin}`)
  return execElide(bin, [
    ElideCommand.RUN,
    '-c',
    '"console.log(\'Elide ready.\')"'
  ])
}

/**
 * Print info about the specified Elide runtime binary.
 *
 * @param bin Path to the Elide binary.
 * @return Promise which resolves when finished.
 */
export async function info(bin: string): Promise<void> {
  core.debug(`Printing runtime info at bin: ${bin}`)
  return execElide(bin, [ElideCommand.INFO])
}

/**
 * Run Elide's embedded self-test suite.
 *
 * @param bin Path to the Elide binary.
 * @return Promise which resolves when finished.
 */
export async function selftest(bin: string): Promise<void> {
  core.info(`Running Elide's self-test...`)
  return execElide(bin, [ElideCommand.SELFTEST])
}

/**
 * Interrogate the specified binary to obtain the version.
 *
 * @param bin Path to the Elide binary.
 * @return Promise which resolves to the obtained version.
 */
export async function obtainVersion(bin: string): Promise<string> {
  core.debug(`Obtaining version of Elide binary at: ${bin}`)
  return (await exec.getExecOutput(`"${bin}"`, [ElideArgument.VERSION])).stdout
    .trim()
    .replaceAll('%0A', '')
}
