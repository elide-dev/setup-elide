import path from 'node:path'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as toolCache from '@actions/tool-cache'
import { which } from '@actions/io'
import type { ElideRelease } from './releases'
import { buildCdnAssetUrl } from './releases'
import type { ElideSetupActionOptions } from './options'
import { obtainVersion } from './command'

export async function installViaMsi(
  options: ElideSetupActionOptions
): Promise<ElideRelease> {
  const url = buildCdnAssetUrl(options, 'msi')
  core.info(`Downloading Elide MSI from ${url}`)
  const msiPath = await toolCache.downloadTool(url.toString())

  core.info('Installing Elide via MSI')
  const installDir = options.install_path || 'C:\\Elide'
  await exec.exec('msiexec', [
    '/i',
    msiPath,
    '/quiet',
    '/norestart',
    `INSTALLDIR=${installDir}`
  ])

  const elidePath = await which('elide', true)
  const version = await obtainVersion(elidePath)
  const elideBin = path.dirname(elidePath)
  const elideHome = elideBin

  core.info(`Elide ${version} installed via MSI at ${elidePath}`)

  return {
    version: { tag_name: version, userProvided: options.version !== 'latest' },
    elidePath,
    elideHome,
    elideBin
  }
}
