import { describe, it, expect, beforeEach, mock } from 'bun:test'

const mockAccess = mock(() => Promise.resolve())
mock.module('node:fs/promises', () => ({
  access: mockAccess
}))

const { isDebianLike, isRpmBased } = await import('../src/platform')

describe('platform detection', () => {
  beforeEach(() => {
    mockAccess.mockReset()
  })

  it('should return true when /etc/debian_version exists', async () => {
    mockAccess.mockResolvedValueOnce(undefined)
    expect(await isDebianLike()).toBe(true)
    expect(mockAccess).toHaveBeenCalledWith('/etc/debian_version')
  })

  it('should return false when /etc/debian_version does not exist', async () => {
    mockAccess.mockRejectedValueOnce(new Error('ENOENT: no such file'))
    expect(await isDebianLike()).toBe(false)
  })

  it('should return true when /etc/redhat-release exists', async () => {
    mockAccess.mockResolvedValueOnce(undefined)
    expect(await isRpmBased()).toBe(true)
    expect(mockAccess).toHaveBeenCalledWith('/etc/redhat-release')
  })

  it('should return false when /etc/redhat-release does not exist', async () => {
    mockAccess.mockRejectedValueOnce(new Error('ENOENT: no such file'))
    expect(await isRpmBased()).toBe(false)
  })
})
