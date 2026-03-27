import path from 'node:path'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import { which } from '@actions/io'
import type { ElideRelease } from './releases'
import type { ElideSetupActionOptions } from './options'
import { obtainVersion } from './command'

/**
 * Map the normalized arch token used by the action to the Debian arch name.
 */
function debianArch(arch: 'amd64' | 'aarch64'): string {
  switch (arch) {
    case 'amd64':
      return 'amd64'
    case 'aarch64':
      return 'arm64'
  }
}

/**
 * Install Elide via the official apt repository.
 *
 * Steps:
 *   1. Import the Elide GPG signing key.
 *   2. Add the apt repository source.
 *   3. `apt-get update` and `apt-get install elide`.
 *
 * @param options Effective action options.
 * @return Release information for the installed binary.
 */
export async function installViaApt(
  options: ElideSetupActionOptions
): Promise<ElideRelease> {
  const arch = debianArch(options.arch)

  // 1. Import GPG key
  core.info('Adding Elide apt repository GPG key')
  await exec.exec('bash', [
    '-c',
    'set -o pipefail && curl -fsSL https://keys.elide.dev/gpg.key | sudo gpg --batch --yes --dearmor -o /usr/share/keyrings/elide.gpg'
  ])

  // 2. Add apt source
  core.info('Adding Elide apt repository')
  const sourceLine = `deb [arch=${arch} signed-by=/usr/share/keyrings/elide.gpg] https://dl.elide.dev nightly main`
  await exec.exec('sudo', ['tee', '/etc/apt/sources.list.d/elide.list'], {
    input: Buffer.from(sourceLine)
  })

  // 3. Update and install
  core.info('Installing Elide via apt')
  await exec.exec('sudo', ['apt-get', 'update', '-qq'])

  const installArgs = ['apt-get', 'install', '-y', '-qq']
  if (
    options.version &&
    options.version !== 'latest' &&
    options.version !== 'local'
  ) {
    installArgs.push(`elide=${options.version}`)
  } else {
    installArgs.push('elide')
  }
  await exec.exec('sudo', installArgs)

  // 4. Locate the installed binary
  const elidePath = await which('elide', true)
  const version = await obtainVersion(elidePath)
  const elideBin = path.dirname(elidePath)
  const elideHome = elideBin

  core.info(`Elide ${version} installed via apt at ${elidePath}`)

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
