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

// Matches tags like "nightly-20260328" or "nightly-2026-03-28"
const NIGHTLY_TAG_RE = /^nightly-(.+)$/

// Matches tags with semver build metadata, like "1.4.0+20260707". Requires a
// semver-shaped prefix (major.minor.patch, optional prerelease) and a build
// segment made of valid semver identifiers (dot-separated alphanumerics/
// hyphens), so arbitrary "+"-containing strings (fork tags, typos, or a
// build segment with e.g. an underscore) don't get treated as nightly
// build-metadata tags — toSemverCacheKey's `-build.<segment>` substitution
// must itself always be a semver-cleanable string.
const BUILD_META_TAG_RE =
  /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)$/

/**
 * Convert a release tag to a valid semver string for use with @actions/tool-cache.
 *
 * tool-cache's `find()` calls `semver.clean()` on the version, which returns null
 * for non-semver strings like "nightly-20260328". This causes cache lookups to
 * silently fail (never hit, never store correctly).
 *
 * We use prerelease (not build metadata with +) because semver.clean strips
 * build metadata, making it useless for cache key matching.
 *
 * Mapping:
 *   "1.0.0"              → "1.0.0"                    (already semver)
 *   "1.0.0-beta10"       → "1.0.0-beta10"             (valid semver prerelease)
 *   "1.4.0+20260707"     → "1.4.0-build.20260707"     (build metadata → prerelease)
 *   "nightly-20260328"   → "0.0.0-nightly.20260328"
 */
export function toSemverCacheKey(tag: string): string {
  const nightlyMatch = tag.match(NIGHTLY_TAG_RE)
  if (nightlyMatch) {
    // Use prerelease segment so semver.clean preserves it
    const datePart = nightlyMatch[1].replaceAll('-', '')
    return `0.0.0-nightly.${datePart}`
  }
  const buildMetaMatch = tag.match(BUILD_META_TAG_RE)
  if (buildMetaMatch) {
    // semver.clean strips +build metadata; convert to prerelease so it's preserved
    return `${buildMetaMatch[1]}-build.${buildMetaMatch[2]}`
  }
  return tag
}

/**
 * A single downloadable asset attached to a GitHub release.
 */
export type ReleaseAsset = {
  // Asset file name, e.g. "elide.linux-amd64.tgz".
  name: string

  // Direct download URL for the asset (GitHub's `browser_download_url`).
  url: string
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

  // Release assets, if resolved via the GitHub API (nightly/build-metadata tags only).
  assets?: ReleaseAsset[]
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
 * Find a release asset matching the current platform, if one is available.
 *
 * @param version Resolved version info (may or may not carry `assets`).
 * @param options Effective options (uses os, arch).
 * @param ext File extension to match (e.g. 'tgz', 'txz', 'zip').
 * @return The asset's download URL, or `null` if none matched.
 */
function findAssetUrl(
  version: ElideVersionInfo,
  options: ElideSetupActionOptions,
  ext: string
): string | null {
  if (!version.assets || version.assets.length === 0) {
    return null
  }
  const os = cdnOs(options.os)
  const arch = cdnArch(options.arch)
  const assetName = `elide.${os}-${arch}.${ext}`
  return version.assets.find(a => a.name === assetName)?.url ?? null
}

/**
 * Build a download URL for an Elide release archive.
 * Selects the best archive format based on local tool availability.
 * If `version` carries release assets with a match for the current platform
 * (resolved via {@link resolveVersionByTag} for nightly/build-metadata tags),
 * that asset's URL is preferred over the CDN URL.
 *
 * @param options Effective options.
 * @param version Resolved version info; may carry release assets to prefer.
 * @return URL and archive type to use.
 */
export async function buildDownloadUrl(
  options: ElideSetupActionOptions,
  version?: ElideVersionInfo
): Promise<{ url: URL; archiveType: ArchiveType }> {
  const hasXz = await which('xz')

  // Candidate archive formats in preference order. TXZ requires the `xz`
  // CLI tool locally (unpackRelease shells out to it); GZIP/ZIP don't. A
  // release may not publish every format, so when matching against release
  // assets we try each viable candidate rather than committing to just the
  // most-preferred one and missing an asset published in another format.
  const candidates: { ext: string; archiveType: ArchiveType }[] =
    options.os === ElideOS.WINDOWS
      ? [{ ext: 'zip', archiveType: ArchiveType.ZIP }]
      : hasXz
        ? [
            { ext: 'txz', archiveType: ArchiveType.TXZ },
            { ext: 'tgz', archiveType: ArchiveType.GZIP }
          ]
        : [{ ext: 'tgz', archiveType: ArchiveType.GZIP }]

  if (version) {
    for (const candidate of candidates) {
      const assetUrl = findAssetUrl(version, options, candidate.ext)
      if (assetUrl) {
        core.debug(`Using GitHub release asset for download: ${assetUrl}`)
        return { archiveType: candidate.archiveType, url: new URL(assetUrl) }
      }
    }
  }

  const { ext, archiveType } = candidates[0]
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

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

/**
 * Fetch the latest Elide release from GitHub, with retry on transient failures.
 *
 * @param token GitHub token active for this workflow step.
 */
export async function resolveLatestVersion(
  token?: string
): Promise<ElideVersionInfo> {
  if (!token) {
    core.warning(
      'No GitHub token provided. API requests may be rate-limited. ' +
        'Set the `token` input or ensure GITHUB_TOKEN is available.'
    )
  }
  const octokit = token ? github.getOctokit(token) : new Octokit({})

  let lastError: Error | undefined
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
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
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const isRateLimit =
        lastError.message.includes('rate limit') ||
        lastError.message.includes('quota exhausted') ||
        lastError.message.includes('403') ||
        lastError.message.includes('429')

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt
        core.warning(
          `GitHub API request failed (attempt ${attempt}/${MAX_RETRIES}): ${lastError.message}. Retrying in ${delay}ms...`
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      } else if (isRateLimit) {
        core.error(
          'GitHub API rate limit exhausted. Provide a token via the `token` input to increase the limit.',
          { title: 'Rate Limited' }
        )
      }
    }
  }

  throw lastError!
}

/**
 * Resolve a nightly or build-metadata-tagged release by its exact tag, via the GitHub
 * Releases API. Used only for tags shaped like `nightly-<...>` or `<semver>+<build>`,
 * since the CDN does not reliably publish artifacts at those exact revision strings.
 *
 * Unlike `resolveLatestVersion`, this function never throws: on any failure (not-found,
 * transient error, exhausted retries) it falls back to a plain, asset-less version info
 * object so callers degrade gracefully to today's CDN-only download path.
 *
 * @param tag The exact tag to look up (e.g. "1.4.1+20260716" or "nightly-20260328").
 * @param token GitHub token active for this workflow step.
 */
export async function resolveVersionByTag(
  tag: string,
  token?: string
): Promise<ElideVersionInfo> {
  if (!token) {
    core.warning(
      'No GitHub token provided. API requests may be rate-limited. ' +
        'Set the `token` input or ensure GITHUB_TOKEN is available.'
    )
  }
  const octokit = token ? github.getOctokit(token) : new Octokit({})

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const release = await octokit.request(
        'GET /repos/{owner}/{repo}/releases/tags/{tag}',
        {
          owner: 'elide-dev',
          repo: 'elide',
          tag,
          headers: GITHUB_DEFAULT_HEADERS
        }
      )

      const name = release.data?.name || undefined
      const assets: ReleaseAsset[] = (release.data.assets ?? []).map(a => ({
        name: a.name,
        url: a.browser_download_url
      }))
      return {
        tag_name: tag,
        name,
        userProvided: true,
        assets
      }
    } catch (err) {
      const lastError = err instanceof Error ? err : new Error(String(err))
      const status = (err as { status?: number } | undefined)?.status
      const isNotFound =
        status === 404 || lastError.message.includes('Not Found')

      if (isNotFound) {
        core.debug(
          `No release found for tag '${tag}' via GitHub API; falling back to CDN. (${lastError.message})`
        )
        break
      }

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt
        core.warning(
          `GitHub API request failed (attempt ${attempt}/${MAX_RETRIES}): ${lastError.message}. Retrying in ${delay}ms...`
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        core.warning(
          `Exhausted retries resolving tag '${tag}' via GitHub API; falling back to CDN. (${lastError.message})`,
          { title: 'GitHub API Resolution Failed' }
        )
      }
    }
  }

  return { tag_name: tag, userProvided: true }
}

/**
 * Conditionally download the desired version of Elide, or use a cached version, if available.
 *
 * @param version Resolved version info for the desired copy of Elide.
 * @param options Effective setup action options.
 * @param resolveAssets Optional lazy resolver for release assets (e.g. {@link resolveVersionByTag}).
 *   Invoked only on a cache miss, since a cache hit never needs release assets to build a download URL.
 */
async function maybeDownload(
  version: ElideVersionInfo,
  options: ElideSetupActionOptions,
  resolveAssets?: () => Promise<ElideVersionInfo>
): Promise<ElideRelease> {
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
  const cacheVersion = toSemverCacheKey(version.tag_name)

  try {
    core.debug(
      `Checking for cached tool 'elide' at version '${version.tag_name}' (cache key: ${cacheVersion})`
    )
    elideDir = toolCache.find('elide', cacheVersion, options.arch)
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

    // Only resolve release assets (a GitHub API round-trip) once we know
    // we actually need to download — a cache hit never needs them.
    if (resolveAssets) {
      version = await resolveAssets()
    }
    const { url, archiveType } = await buildDownloadUrl(options, version)

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
        cacheVersion,
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
    let resolveAssets: (() => Promise<ElideVersionInfo>) | undefined
    if (options.version === 'latest') {
      core.debug('Resolving latest version via GitHub API')
      versionInfo = await resolveLatestVersion(options.token)
    } else if (
      NIGHTLY_TAG_RE.test(options.version) ||
      BUILD_META_TAG_RE.test(options.version)
    ) {
      // Defer the GitHub API call until maybeDownload confirms a cache miss —
      // a cache hit never needs release assets, only the tag string below.
      versionInfo = { tag_name: options.version, userProvided: true }
      const pinnedVersion = options.version
      resolveAssets = () => {
        core.debug(
          `Resolving pinned nightly/build-metadata tag '${pinnedVersion}' via GitHub API`
        )
        return resolveVersionByTag(pinnedVersion, options.token)
      }
    } else {
      versionInfo = {
        tag_name: options.version,
        userProvided: true
      }
    }

    // setup caching with the effective version and perform download
    return maybeDownload(versionInfo, options, resolveAssets)
  }
}
