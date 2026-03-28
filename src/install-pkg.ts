import path from 'node:path'
import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as toolCache from '@actions/tool-cache'
import { which } from '@actions/io'
import type { ElideRelease } from './releases'
import { buildCdnAssetUrl } from './releases'
import type { ElideSetupActionOptions } from './options'
import { obtainVersion } from './command'

export async function installViaPkg(
  options: ElideSetupActionOptions
): Promise<ElideRelease> {
  const url = buildCdnAssetUrl(options, 'pkg')
  core.info(`Downloading Elide PKG from ${url}`)
  const pkgPath = await toolCache.downloadTool(url.toString())

  core.info('Installing Elide via PKG')
  await exec.exec('sudo', ['installer', '-pkg', pkgPath, '-target', '/'])

  const elidePath = await which('elide', true)
  const version = await obtainVersion(elidePath)
  const elideBin = path.dirname(elidePath)
  const elideHome = elideBin

  core.info(`Elide ${version} installed via PKG at ${elidePath}`)

  return {
    version: { tag_name: version, userProvided: options.version !== 'latest' },
    elidePath,
    elideHome,
    elideBin
  }
}
