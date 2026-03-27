import * as io from '@actions/io'
import {
  resolveLatestVersion,
  buildDownloadUrl,
  ArchiveType
} from '../src/releases'
import buildOptions from '../src/options'

describe('elide release', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should support resolving the latest version', async () => {
    expect(await resolveLatestVersion()).not.toBeNull()
  })
})

describe('buildDownloadUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should use nightly channel and strip prefix from nightly tags', async () => {
    jest.spyOn(io, 'which').mockResolvedValue('')
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0'
    })
    const version = {
      tag_name: 'nightly-20260323',
      userProvided: false
    }
    const { url, archiveType } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://dist.elide.zip/artifacts/nightly/20260323/elide.linux-amd64.tgz'
    )
    expect(archiveType).toBe(ArchiveType.GZIP)
  })

  it('should use preview channel and strip prefix from preview tags', async () => {
    jest.spyOn(io, 'which').mockResolvedValue('')
    const options = buildOptions({
      os: 'darwin',
      arch: 'aarch64',
      version: '1.0.0'
    })
    const version = {
      tag_name: 'preview-20260323',
      userProvided: false
    }
    const { url } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://dist.elide.zip/artifacts/preview/20260323/elide.darwin-aarch64.tgz'
    )
  })

  it('should use release channel for semver tags', async () => {
    jest.spyOn(io, 'which').mockResolvedValue('')
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0'
    })
    const version = {
      tag_name: '1.0.0',
      userProvided: true
    }
    const { url } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://dist.elide.zip/artifacts/release/1.0.0/elide.linux-amd64.tgz'
    )
  })

  it('should use "latest" revision when version is latest', async () => {
    jest.spyOn(io, 'which').mockResolvedValue('')
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: 'latest'
    })
    const version = {
      tag_name: 'nightly-20260323',
      userProvided: false
    }
    const { url } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://dist.elide.zip/artifacts/nightly/latest/elide.linux-amd64.tgz'
    )
  })

  it('should use zip for Windows', async () => {
    jest.spyOn(io, 'which').mockResolvedValue('')
    const options = buildOptions({
      os: 'windows',
      arch: 'amd64',
      version: 'latest'
    })
    const version = {
      tag_name: 'nightly-20260323',
      userProvided: false
    }
    const { url, archiveType } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://dist.elide.zip/artifacts/nightly/latest/elide.windows-amd64.zip'
    )
    expect(archiveType).toBe(ArchiveType.ZIP)
  })

  it('should use txz when xz is available', async () => {
    jest.spyOn(io, 'which').mockResolvedValue('/usr/bin/xz')
    const options = buildOptions({
      os: 'linux',
      arch: 'amd64',
      version: '1.0.0'
    })
    const version = {
      tag_name: '1.0.0',
      userProvided: true
    }
    const { url, archiveType } = await buildDownloadUrl(options, version)
    expect(url.toString()).toBe(
      'https://dist.elide.zip/artifacts/release/1.0.0/elide.linux-amd64.txz'
    )
    expect(archiveType).toBe(ArchiveType.TXZ)
  })
})
