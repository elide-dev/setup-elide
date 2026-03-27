const mockAccess = jest.fn()
jest.mock('node:fs/promises', () => ({
  access: mockAccess
}))

import { isDebianLike } from '../src/platform'

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
})
