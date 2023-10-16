import fs from 'node:fs'
import * as core from '@actions/core'
import * as exec from '@actions/exec'

export enum ElideCommand {
  RUN = 'run',
  INFO = 'info',
  SELFTEST = 'selftest'
}

export enum ElideArgument {
  VERSION = '--version'
}

async function execElide(bin: string, args?: string[]): Promise<void> {
  core.debug(`Executing: bin=${bin}, args=${args}`)
  if (fs.existsSync(bin)) {
    const exit = await exec.exec(`"${bin}"`, args || [])
    if (exit === 0) {
      return
    }
    return Promise.reject(new Error(`Elide execution failed: exitCode=${exit}`))
  }
  return Promise.reject(
    new Error(`Elide execution failed: does not exist at path ${bin}`)
  )
}

export async function prewarm(bin: string): Promise<void> {
  core.info(`Prewarming Elide at bin: ${bin}`)
  return execElide(bin, [
    ElideCommand.RUN,
    '-c',
    '"console.log(\'Elide ready.\')"'
  ])
}

export async function info(bin: string): Promise<void> {
  core.debug(`Printing runtime info at bin: ${bin}`)
  return execElide(bin, [ElideCommand.INFO])
}

export async function selftest(bin: string): Promise<void> {
  core.info(`Running Elide's self-test...`)
  return execElide(bin, [ElideCommand.SELFTEST])
}

export async function obtainVersion(bin: string): Promise<string> {
  try {
    core.debug(`Obtaining version of Elide binary at: ${bin}`)
    return (
      await exec.getExecOutput(`"${bin}"`, [ElideArgument.VERSION])
    ).stdout
      .trim()
      .replaceAll('%0A', '')
  } catch (err) {
    core.error(`Failed to obtain version from Elide binary: ${err}`)
    return Promise.reject(err)
  }
}
