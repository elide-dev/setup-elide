import * as core from '@actions/core'
import { Octokit } from 'octokit'
import * as toolCache from '@actions/tool-cache'
import * as github from '@actions/github'
import type { ElideSetupActionOptions } from './options'
import { GITHUB_DEFAULT_HEADERS } from './config'

const downloadBase = 'https://dl.azr.elide.cloud'
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
function buildDownloadUrl(
  options: ElideSetupActionOptions,
  version?: ElideVersionInfo
): { url: URL; archiveType: ArchiveType } {
  const customUrl = options.custom_url
  if (customUrl) {
    core.debug(`Using custom URL: ${customUrl}`)

    try {
      return {
        url: new URL(customUrl),
        archiveType: customUrl.endsWith('.zip')
          ? ArchiveType.ZIP
          : ArchiveType.GZIP
      }
    } catch (err) {
      core.error(`Failed to parse custom download URL: ${err}`)
      throw err
    }
  } else if (version) {
    let ext = 'tgz'
    let archiveType = ArchiveType.GZIP
    if (options.os === ElideOS.WINDOWS) {
      ext = 'zip'
      archiveType = ArchiveType.ZIP
    }

    return {
      archiveType,
      url: new URL(
        // https://... / cli/v1/snapshot / (os)-(arch) / elide.(extension)
        `${downloadBase}/${downloadPathV1}/${options.os}-${options.arch}/${version.tag_name}/elide.${ext}`
      )
    }
  } else {
    throw new Error('No version or custom URL resolvable for inputs')
  }
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
      repo: 'releases',
      headers: GITHUB_DEFAULT_HEADERS
    }
  )

  if (!latest) {
    throw new Error('Failed to fetch the latest Elide version')
  }
  return {
    name: latest.data.name || undefined,
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
  const { url, archiveType } = buildDownloadUrl(options, version)
  core.info(`Installing from URL: ${url} (type: ${archiveType})`)

  let targetBin = `${options.target}/elide`
  if (options.os === ElideOS.WINDOWS) {
    targetBin = `${options.target}\\elide.exe`
  }

  // build resulting tarball path and resolved tool info
  let elidePath: string = targetBin
  let elideHome: string = options.target
  const elideBin: string = elideHome // @TODO(sgammon): bin folder?
  let elideDir: string | null = null
  try {
    elideDir = toolCache.find('elide', version.tag_name, options.arch)
  } catch (err) {
    core.debug(`Failed to locate Elide in tool cache: ${err}`)
  }
  if (options.cache && elideDir) {
    // we have an existing cached copy of elide
    core.debug('Caching enabled and cached Elide release found; using it')
    elidePath = elideDir
  } else {
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
      core.error(`Failed to download Elide release: ${err}`)
      if (err instanceof Error) core.setFailed(err)
      throw err
    }

    core.debug(`Elide release downloaded to: ${elideArchive}`)

    try {
      if (options.os === ElideOS.WINDOWS) {
        core.debug(`Extracting as zip on Windows, at path: ${elideHome}`)
        elideHome = await toolCache.extractZip(elideHome)
      } else {
        switch (archiveType) {
          // extract as zip
          case ArchiveType.ZIP:
            core.debug(
              `Extracting as zip on Unix or Linux, at path: ${elideHome}`
            )
            elideHome = await toolCache.extractZip(elideArchive, elideHome)
            break

          // extract as tgz
          case ArchiveType.GZIP:
            core.debug(
              `Extracting as tgz on Unix or Linux, at path: ${elideHome}`
            )
            elideHome = await toolCache.extractTar(elideArchive, elideHome)
            break
        }
      }
    } catch (err) {
      core.error(`Failed to extract Elide release: ${err}`)
      if (err instanceof Error) core.setFailed(err)
      throw err
    }
  }

  return {
    version,
    elidePath,
    elideHome,
    elideBin
  }
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
    throw new Error('Custom URL downloads are not implemented yet')
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
