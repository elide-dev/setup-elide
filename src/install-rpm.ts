import path from 'node:path'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as toolCache from '@actions/tool-cache'
import { which } from '@actions/io'
import type { ElideRelease } from './releases'
import { buildCdnAssetUrl } from './releases'
import type { ElideSetupActionOptions } from './options'
import { obtainVersion } from './command'

export async function installViaRpm(
  options: ElideSetupActionOptions
): Promise<ElideRelease> {
  const url = buildCdnAssetUrl(options, 'rpm')
  core.info(`Downloading Elide RPM from ${url}`)
  const rpmPath = await toolCache.downloadTool(url.toString())

  // Try dnf first (modern RHEL/Fedora), fall back to rpm
  let useDnf = false
  try {
    await which('dnf', true)
    useDnf = true
  } catch {
    // dnf not available, will use rpm
  }

  if (useDnf) {
    core.info('Installing Elide via dnf')
    await exec.exec('sudo', ['dnf', 'install', '-y', rpmPath])
  } else {
    core.info('Installing Elide via rpm')
    await exec.exec('sudo', ['rpm', '-i', rpmPath])
  }

  const elidePath = await which('elide', true)
  const version = await obtainVersion(elidePath)
  const elideBin = path.dirname(elidePath)
  const elideHome = elideBin

  core.info(`Elide ${version} installed via RPM at ${elidePath}`)

  return {
    version: { tag_name: version, userProvided: options.version !== 'latest' },
    elidePath,
    elideHome,
    elideBin
  }
}
