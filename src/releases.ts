import * as core from '@actions/core'
import { Octokit } from 'octokit'
import * as toolCache from '@actions/tool-cache'
import * as github from '@actions/github'
import type { ElideSetupActionOptions } from './options'
import { obtainVersion } from './command'
import { which, mv } from '@actions/io'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const downloadBase = 'https://elide.zip'

const GITHUB_API_VERSION = '2022-11-28'

const GITHUB_DEFAULT_HEADERS = {
  'X-GitHub-Api-Version': GITHUB_API_VERSION
}

/**
 * Version info resolved for a release of Elide.
 */
export type ElideVersionInfo = {
  // Name of the release, if available.
  name?: string

  // String identifying the version tag.
  tag_name: string

  // Whether this version is resolved (`false`) or user-provided (`true`).
  userProvided: boolean
}

/**
 * Release archive type.
 */
export enum ArchiveType {
  // Release is compressed with `gzip`.
  GZIP = 'gzip',

  // Release is compressed as a tarball with `xz`.
  TXZ = 'txz',

  // Release is compressed with `zip`.
  ZIP = 'zip'
}

/**
 * Information about an Elide release.
 */
export type ElideRelease = {
  // Resolved version, from fetching the latest version, or from the user's provided version.
  version: ElideVersionInfo

  // Path to the installed binary.
  elidePath: string

  // Path to Elide's home.
  elideHome: string

  // Path to Elide's bin folder.
  elideBin: string

  // Whether this release was served from the tool cache.
  cached?: boolean

  // Deferred cleanup or after-action method.
  deferred?: () => Promise<void>
}

/**
 * Enumerates operating systems recognized by the action; presence in this enum does not
 * guarantee support.
 */
export enum ElideOS {
  // Darwin/macOS.
  MACOS = 'darwin',

  // Linux.
  LINUX = 'linux',

  // Windows.
  WINDOWS = 'windows'
}

/**
 * Enumerates architectures recognized by the action; presence in this enum does not
 * guarantee support.
 */
export enum ElideArch {
  // AMD64 and x86_64.
  AMD64 = 'amd64',

  // ARM64 and aarch64.
  ARM64 = 'aarch64'
}

/**
 * Describes downloaded and cached tool info.
 */
export interface DownloadedToolInfo {
  url: URL
  tarballPath: string
  archiveType: ArchiveType
}

/**
 * Map the internal OS token to the CDN platform tag.
 * The elide.zip CDN expects "macos" (not "darwin").
 */
export function cdnOs(os: string): string {
  return os === 'darwin' ? 'macos' : os
}

/**
 * Map the internal arch token to the CDN platform tag.
 * The elide.zip CDN expects "arm64" (not "aarch64").
 */
export function cdnArch(arch: string): string {
  return arch === 'aarch64' ? 'arm64' : arch
}

/**
 * Build a CDN asset URL for an Elide release artifact.
 * Appends `?source=gha` for analytics tracking.
 *
 * @param options Effective options (uses channel, version, os, arch).
 * @param ext File extension (e.g. 'tgz', 'txz', 'zip', 'msi', 'pkg', 'rpm').
 * @return Full CDN URL.
 */
export function buildCdnAssetUrl(
  options: ElideSetupActionOptions,
  ext: string
): URL {
  const channel = options.channel || 'nightly'
  const revision = options.version === 'latest' ? 'latest' : options.version
  const os = cdnOs(options.os)
  const arch = cdnArch(options.arch)
  return new URL(
    `${downloadBase}/artifacts/${channel}/${revision}/elide.${os}-${arch}.${ext}?source=gha`
  )
}

/**
 * Build a download URL for an Elide release archive.
 * Selects the best archive format based on local tool availability.
 *
 * @param options Effective options.
 * @return URL and archive type to use.
 */
export async function buildDownloadUrl(
  options: ElideSetupActionOptions
): Promise<{ url: URL; archiveType: ArchiveType }> {
  let ext = 'tgz'
  let archiveType = ArchiveType.GZIP
  const hasXz = await which('xz')

  if (options.os === ElideOS.WINDOWS) {
    ext = 'zip'
    archiveType = ArchiveType.ZIP
  } else if (hasXz) {
    ext = 'txz'
    archiveType = ArchiveType.TXZ
  }

  return {
    archiveType,
    url: buildCdnAssetUrl(options, ext)
  }
}

/**
 * Unpack a release archive.
 *
 * @param archive Path to the archive.
 * @param elideHome Unpack target.
 * @param archiveType Type of archive to unpack.
 * @param resolvedVersion Actual version (not a symbolic version)
 * @param options Options which apply to this action run.
 * @return Path to the unpacked release.
 */
async function unpackRelease(
  archive: string,
  elideHome: string,
  archiveType: ArchiveType,
  resolvedVersion: string,
  options: ElideSetupActionOptions
): Promise<string> {
  let target: string
  try {
    if (options.os === ElideOS.WINDOWS) {
      core.debug(
        `Extracting as zip on Windows, from: ${archive}, to: ${elideHome}`
      )
      target = await toolCache.extractZip(archive, elideHome)
    } else {
      const tarArchive = `${archive}.tar`

      switch (archiveType) {
        // extract as zip
        case ArchiveType.ZIP:
          core.debug(
            `Extracting as zip on Unix or Linux, from: ${archive}, to: ${elideHome}`
          )
          target = await toolCache.extractZip(archive, elideHome)
          break

        // extract as tgz
        case ArchiveType.GZIP:
          core.debug(
            `Extracting as tgz on Unix or Linux, from: ${archive}, to: ${elideHome}`
          )
          target = await toolCache.extractTar(archive, elideHome, [
            'xz',
            '--strip-components=1'
          ])
          break

        // extract as txz
        case ArchiveType.TXZ:
          {
            core.debug(
              `Extracting as txz on Unix or Linux, from: ${archive}, to: ${elideHome}`
            )
            const xzTool = await which('xz')
            if (!xzTool) {
              throw new Error('xz command not found, please install xz-utils')
            }
            core.debug(`xz command found at: ${xzTool}`)

            // xz is moody about archive names. so rename it.
            const xzArchive = `${tarArchive}.xz`
            await mv(archive, xzArchive, { force: false })

            // check if the archive exists
            if (!existsSync(xzArchive)) {
              throw new Error(
                `Archive not found (renaming failed?): ${xzArchive} (renamed)`
              )
            }

            // unpack using xz first; we pass `-v` for verbose and `-d` to decompress
            const xzRun = spawnSync(xzTool, ['-v', '-d', xzArchive], {
              encoding: 'utf-8'
            })
            if (xzRun.status !== 0) {
              console.log('XZ output: ', xzRun.stdout)
              console.error('XZ error output: ', xzRun.stderr)
              throw new Error(`xz extraction failed: ${xzRun.stderr}`)
            }
            core.debug(`XZ extraction completed: ${xzRun.status}`)
          }

          // now extract the tarball
          target = await toolCache.extractTar(tarArchive, elideHome, [
            'x',
            '--strip-components=1'
          ])
          break
      }
    }
  } catch (err) {
    core.warning(`Failed to extract Elide release: ${err}`)
    target = elideHome
  }

  core.debug(`Elide release ${resolvedVersion} extracted at ${target}`)
  return target
}

/**
 * Fetch the latest Elide release from GitHub.
 *
 * @param token GitHub token active for this workflow step.
 */
export async function resolveLatestVersion(
  token?: string
): Promise<ElideVersionInfo> {
  const octokit = token ? github.getOctokit(token) : new Octokit({})
  const latest = await octokit.request(
    'GET /repos/{owner}/{repo}/releases/latest',
    {
      owner: 'elide-dev',
      repo: 'elide',
      headers: GITHUB_DEFAULT_HEADERS
    }
  )

  if (!latest) {
    throw new Error('Failed to fetch the latest Elide version')
  }
  const name = latest.data?.name || undefined
  return {
    name,
    tag_name: latest.data.tag_name,
    userProvided: !!token
  }
}

/**
 * Conditionally download the desired version of Elide, or use a cached version, if available.
 *
 * @param version Resolved version info for the desired copy of Elide.
 * @param options Effective setup action options.
 */
async function maybeDownload(
  version: ElideVersionInfo,
  options: ElideSetupActionOptions
): Promise<ElideRelease> {
  // build download URL, use result from cache or disk
  const { url, archiveType } = await buildDownloadUrl(options)
  const sep = options.os === ElideOS.WINDOWS ? '\\' : '/'
  const binName = options.os === ElideOS.WINDOWS ? 'elide.exe' : 'elide'
  let targetBin = `${options.install_path}${sep}bin${sep}${binName}`

  if (options.no_cache === true) {
    console.info('Tool caching is disabled.')
  }

  // build resulting tarball path and resolved tool info
  let elidePath = targetBin
  let elideHome: string = process.env.ELIDE_HOME || options.install_path
  let elidePathTarget = elideHome
  let elideBin: string = `${elideHome}${sep}bin`
  let elideDir: string | null = null

  try {
    core.debug(
      `Checking for cached tool 'elide' at version '${version.tag_name}'`
    )
    elideDir = toolCache.find('elide', version.tag_name, options.arch)
  } catch (err) {
    core.debug(`Failed to locate Elide in tool cache: ${err}`)
  }
  if (options.no_cache !== true && elideDir) {
    // we have an existing cached copy of elide
    core.debug('Caching enabled and cached Elide release found; using it')
    elidePath = `${elideDir}${sep}bin${sep}${binName}`
    elidePathTarget = elideDir
    elideBin = `${elideDir}${sep}bin`
    core.info(`Using cached copy of Elide at version ${version.tag_name}`)
  } else {
    if (options.no_cache) {
      core.debug(
        'Cache disabled; forcing a fetch of the specified Elide release'
      )
    } else {
      core.debug('Cache enabled but no hit was found; downloading release')
    }

    core.info(`Installing from URL: ${url} (type: ${archiveType})`)

    // we do not have an existing copy; download it
    let elideArchive: string | null = null
    try {
      elideArchive = await toolCache.downloadTool(url.toString())
    } catch (err) {
      core.error(`Failed to download Elide release: ${err}`)
      if (err instanceof Error) core.setFailed(err)
      throw err
    }

    core.debug(`Elide release downloaded to: ${elideArchive}`)

    elideHome = await unpackRelease(
      elideArchive,
      elideHome,
      archiveType,
      version.tag_name,
      options
    )
    elidePathTarget = elideHome

    if (options.no_cache !== true) {
      // cache the tool
      const cachedPath = await toolCache.cacheDir(
        elideHome,
        'elide',
        version.tag_name,
        options.arch
      )

      elidePathTarget = cachedPath
      elideBin = `${cachedPath}${sep}bin`
      core.debug(`Elide release cached at: ${cachedPath}`)
    } else {
      core.debug('Tool caching is disabled; not caching downloaded release')
    }
  }

  const wasCached = !!(options.no_cache !== true && elideDir)
  const result = {
    version,
    elidePath,
    elideHome: elidePathTarget,
    elideBin,
    cached: wasCached
  }
  core.debug(`Elide release info: ${JSON.stringify(result)}`)
  return result
}

/**
 * Fetch a download link for the specified Elide version; if the version is `latest`, fetch
 * the download link which matches for the latest release.
 *
 * @param options Canonical suite of options to use for this action instance.
 */
export async function downloadRelease(
  options: ElideSetupActionOptions
): Promise<ElideRelease> {
  if (options.custom_url) {
    // if we're using a custom URL, download it based on that token
    try {
      core.debug(`Downloading custom archive: ${options.custom_url}`)
      const customArchive = await toolCache.downloadTool(options.custom_url)
      const versionTag = options.version_tag || 'dev'

      // sniff archive type from URL
      let archiveType: ArchiveType = ArchiveType.GZIP
      if (options.custom_url.endsWith('.txz')) {
        archiveType = ArchiveType.TXZ
      } else if (options.custom_url.endsWith('.zip')) {
        archiveType = ArchiveType.ZIP
      }

      let elideHome: string = process.env.ELIDE_HOME || options.install_path
      elideHome = await unpackRelease(
        customArchive,
        elideHome,
        archiveType,
        versionTag,
        options
      )
      const sep = options.os === ElideOS.WINDOWS ? '\\' : '/'
      const binName = options.os === ElideOS.WINDOWS ? 'elide.exe' : 'elide'
      const elideBin = `${elideHome}${sep}bin`
      const elidePath = `${elideBin}${sep}${binName}`

      return {
        version: {
          tag_name: await obtainVersion(elidePath),
          userProvided: true
        },
        elideHome,
        elideBin,
        elidePath
      }
    } catch (err) {
      core.error(`Failed to download custom release: ${err}`)
      if (err instanceof Error) core.setFailed(err)
      throw err
    }
  } else {
    // resolve applicable version
    let versionInfo: ElideVersionInfo
    if (options.version === 'latest') {
      core.debug('Resolving latest version via GitHub API')
      versionInfo = await resolveLatestVersion(options.token)
    } else {
      versionInfo = {
        tag_name: options.version,
        userProvided: true
      }
    }

    // setup caching with the effective version and perform download
    return maybeDownload(versionInfo, options)
  }
}
