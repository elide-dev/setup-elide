import * as core from '@actions/core'
import { Octokit } from 'octokit'
import * as toolCache from '@actions/tool-cache'
import * as github from '@actions/github'
import type { ElideSetupActionOptions } from './options'
import { GITHUB_DEFAULT_HEADERS } from './config'
import { obtainVersion } from './command'
import { which } from '@actions/io'
import { spawnSync } from 'node:child_process'

const downloadBase = 'https://elide.zip'
const downloadPathV1 = 'cli/v1/snapshot'

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
 * Build a download URL for an Elide release; if a custom URL is provided as part of the set of
 * `options`, use it instead.
 *
 * @param version Version we are downloading.
 * @param options Effective options.
 * @return URL and archive type to use.
 */
async function buildDownloadUrl(
  options: ElideSetupActionOptions,
  version: ElideVersionInfo
): Promise<{ url: URL; archiveType: ArchiveType }> {
  let ext = 'tgz'
  let archiveType = ArchiveType.GZIP
  const hasXz = await which('xz')

  /* istanbul ignore next */
  if (options.os === ElideOS.WINDOWS) {
    ext = 'zip'
    archiveType = ArchiveType.ZIP
  } else if (hasXz) {
    // use xz if available
    ext = 'txz'
    archiveType = ArchiveType.TXZ
  }

  return {
    archiveType,
    url: new URL(
      // https://... / cli/v1/snapshot / (os)-(arch) / elide.(extension)
      `${downloadBase}/${downloadPathV1}/${options.os}-${options.arch}/${version.tag_name}/elide.${ext}`
    )
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
    /* istanbul ignore next */
    if (options.os === ElideOS.WINDOWS) {
      core.debug(
        `Extracting as zip on Windows, from: ${archive}, to: ${elideHome}`
      )
      target = await toolCache.extractZip(archive, elideHome)
    } else {
      switch (archiveType) {
        // extract as zip
        /* istanbul ignore next */
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
          core.debug(
            `Extracting as txz on Unix or Linux, from: ${archive}, to: ${elideHome}`
          )
          const xzTool = await which('xz')
          if (!xzTool) {
            throw new Error('xz command not found, please install xz-utils')
          }
          core.debug(`xz command found at: ${xzTool}`)

          // unpack using xz first; we pass `-v` for verbose and `-d` to decompress
          const xzRun = spawnSync(xzTool, ['-v', '-d', archive], {
            encoding: 'utf-8'
          })
          if (xzRun.status !== 0) {
            console.log('XZ output: ', xzRun.stdout)
            console.error('XZ error output: ', xzRun.stderr)
            throw new Error(`xz extraction failed: ${xzRun.stderr}`)
          }
          core.debug(`XZ extraction completed: ${xzRun.status}`)

          // now extract the tarball
          target = await toolCache.extractTar(archive, elideHome, [
            'x',
            '--strip-components=1'
          ])

          // now clean up the xz file
          try {
            const cleanupRun = spawnSync('rm', [archive], { encoding: 'utf-8' })
            if (cleanupRun.status !== 0) {
              console.warn('Failed to remove archive: ', cleanupRun)
            }
          } catch (err) {
            /* istanbul ignore next */
            core.warning(`Failed to remove archive (skipping): ${err}`)
          }
          break
      }
    }
  } catch (err) {
    /* istanbul ignore next */
    core.warning(`Failed to extract Elide release: ${err}`)
    target = elideHome
  }

  // determine if the archive has a directory root
  if (
    resolvedVersion === '1.0.0-alpha7' ||
    resolvedVersion === '1.0.0-alpha8'
  ) {
    return target // no directory root: early release
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
  /* istanbul ignore next */
  const octokit = token ? github.getOctokit(token) : new Octokit({})
  const latest = await octokit.request(
    'GET /repos/{owner}/{repo}/releases/latest',
    {
      owner: 'elide-dev',
      repo: 'elide',
      headers: GITHUB_DEFAULT_HEADERS
    }
  )

  /* istanbul ignore next */
  if (!latest) {
    throw new Error('Failed to fetch the latest Elide version')
  }
  /* istanbul ignore next */
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
  const { url, archiveType } = await buildDownloadUrl(options, version)
  core.info(`Installing from URL: ${url} (type: ${archiveType})`)

  let targetBin = `${options.target}/elide`

  /* istanbul ignore next */
  if (options.os === ElideOS.WINDOWS) {
    targetBin = `${options.target}\\elide.exe`
  }

  // build resulting tarball path and resolved tool info
  let elidePath: string = targetBin
  /* istanbul ignore next */
  let elideHome: string = process.env.ELIDE_HOME || options.target
  const elideBin: string = elideHome // @TODO(sgammon): bin folder?
  let elideDir: string | null = null

  try {
    elideDir = toolCache.find('elide', version.tag_name, options.arch)
  } catch (err) {
    /* istanbul ignore next */
    core.debug(`Failed to locate Elide in tool cache: ${err}`)
  }
  /* istanbul ignore next */
  if (options.cache && elideDir) {
    // we have an existing cached copy of elide
    core.debug('Caching enabled and cached Elide release found; using it')
    elidePath = elideDir
  } else {
    /* istanbul ignore next */
    if (!options.cache) {
      core.debug(
        'Cache disabled; forcing a fetch of the specified Elide release'
      )
    } else {
      core.debug('Cache enabled but no hit was found; downloading release')
    }

    // we do not have an existing copy; download it
    let elideArchive: string | null = null
    try {
      elideArchive = await toolCache.downloadTool(url.toString())
    } catch (err) {
      /* istanbul ignore next */
      core.error(`Failed to download Elide release: ${err}`)
      /* istanbul ignore next */
      if (err instanceof Error) core.setFailed(err)
      /* istanbul ignore next */
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
  }

  const result = {
    version,
    elidePath,
    elideHome,
    elideBin
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
      /* istanbul ignore next */
      if (options.custom_url.endsWith('.zip')) {
        archiveType = ArchiveType.ZIP
      }

      /* istanbul ignore next */
      let elideHome: string = process.env.ELIDE_HOME || options.target
      elideHome = await unpackRelease(
        customArchive,
        elideHome,
        archiveType,
        versionTag,
        options
      )
      const elideBin = elideHome
      /* istanbul ignore next */
      const elidePath =
        options.os === ElideOS.WINDOWS
          ? `${elideBin}\\elide.exe`
          : `${elideBin}/elide`

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
      /* istanbul ignore next */
      core.error(`Failed to download custom release: ${err}`)
      /* istanbul ignore next */
      if (err instanceof Error) core.setFailed(err)
      /* istanbul ignore next */
      throw err
    }
  } else {
    // resolve applicable version
    let versionInfo: ElideVersionInfo
    if (options.version === 'latest') {
      core.debug('Resolving latest version via GitHub API')
      versionInfo = await resolveLatestVersion(options.token)
    } else {
      /* istanbul ignore next */
      versionInfo = {
        tag_name: options.version,
        userProvided: true
      }
    }

    // setup caching with the effective version and perform download
    return maybeDownload(versionInfo, options)
  }
}
