import { resolveLatestVersion } from '../src/releases'

describe('elide release', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should support resolving the latest version', async () => {
    expect(await resolveLatestVersion()).not.toBeNull()
  })
})
