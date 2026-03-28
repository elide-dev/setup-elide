import { describe, it, expect, beforeEach, jest, mock } from 'bun:test'

const initMock = jest.fn()
const setTagsMock = jest.fn()
const captureExceptionMock = jest.fn()
const withScopeMock = jest.fn((cb: (scope: any) => void) => {
  cb({ setTag: jest.fn() })
})
const flushMock = jest.fn().mockResolvedValue(true)

mock.module('@sentry/node', () => ({
  init: initMock,
  setTags: setTagsMock,
  captureException: captureExceptionMock,
  withScope: withScopeMock,
  flush: flushMock
}))

const { initTelemetry, reportError, flushTelemetry } = await import(
  '../src/telemetry'
)
const { default: buildOptions } = await import('../src/options')

describe('telemetry', () => {
  beforeEach(() => {
    initMock.mockClear()
    setTagsMock.mockClear()
    captureExceptionMock.mockClear()
    withScopeMock.mockClear()
    flushMock.mockClear()
  })

  it('should not initialize Sentry when disabled', () => {
    const options = buildOptions({})
    initTelemetry(false, options)
    expect(initMock).not.toHaveBeenCalled()
  })

  it('should initialize Sentry when enabled', () => {
    const options = buildOptions({ channel: 'nightly', os: 'linux' })
    initTelemetry(true, options)
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultIntegrations: false,
        environment: 'nightly'
      })
    )
  })

  it('should set action config tags on init', () => {
    const options = buildOptions({
      installer: 'shell',
      os: 'darwin',
      arch: 'aarch64',
      channel: 'release',
      version: '1.0.0'
    })
    initTelemetry(true, options)
    expect(setTagsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        installer: 'shell',
        os: 'darwin',
        arch: 'aarch64',
        channel: 'release',
        version: '1.0.0'
      })
    )
  })

  it('should strip sensitive data in beforeSend', () => {
    const options = buildOptions({})
    initTelemetry(true, options)

    const beforeSend = initMock.mock.calls[0][0].beforeSend
    const event = {
      message: 'test error',
      server_name: 'runner-abc123',
      extra: { SECRET_KEY: 'leaked' },
      user: { id: 'user123' },
      request: { url: 'https://internal' },
      contexts: { os: { name: 'Linux' } }
    }

    const scrubbed = beforeSend(event)
    expect(scrubbed.message).toBe('test error')
    expect(scrubbed.server_name).toBeUndefined()
    expect(scrubbed.extra).toBeUndefined()
    expect(scrubbed.user).toBeUndefined()
    expect(scrubbed.request).toBeUndefined()
    expect(scrubbed.contexts).toEqual({})
  })

  it('should scrub exception values of env var secrets', () => {
    // Set a fake sensitive env var
    const originalToken = process.env.GITHUB_TOKEN
    process.env.GITHUB_TOKEN = 'ghp_superSecretTokenValue123'
    try {
      const options = buildOptions({})
      initTelemetry(true, options)

      const beforeSend = initMock.mock.calls[0][0].beforeSend
      const event = {
        exception: {
          values: [
            { value: 'Failed to fetch ghp_superSecretTokenValue123' },
            { value: 'another error' }
          ]
        },
        message: 'Error with ghp_superSecretTokenValue123 in message'
      }

      const scrubbed = beforeSend(event)
      expect(scrubbed.exception.values[0].value).toBe(
        'Failed to fetch [REDACTED]'
      )
      expect(scrubbed.exception.values[1].value).toBe('another error')
      expect(scrubbed.message).toBe('Error with [REDACTED] in message')
    } finally {
      if (originalToken) {
        process.env.GITHUB_TOKEN = originalToken
      } else {
        delete process.env.GITHUB_TOKEN
      }
    }
  })

  it('should report errors via captureException', () => {
    const options = buildOptions({})
    initTelemetry(true, options)

    const err = new Error('install failed')
    reportError(err)

    expect(withScopeMock).toHaveBeenCalled()
  })

  it('should report errors with context tags', () => {
    const options = buildOptions({})
    initTelemetry(true, options)

    const setTagMock = jest.fn()
    withScopeMock.mockImplementation((cb: (scope: any) => void) => {
      cb({ setTag: setTagMock })
    })

    reportError(new Error('fail'), { phase: 'download' })

    expect(withScopeMock).toHaveBeenCalled()
    expect(setTagMock).toHaveBeenCalledWith('phase', 'download')
  })

  it('should not report errors when disabled', () => {
    initTelemetry(false, buildOptions({}))
    reportError(new Error('should not send'))
    expect(withScopeMock).not.toHaveBeenCalled()
  })

  it('should flush pending events', async () => {
    initTelemetry(true, buildOptions({}))
    await flushTelemetry()
    expect(flushMock).toHaveBeenCalledWith(2000)
  })

  it('should not flush when disabled', async () => {
    initTelemetry(false, buildOptions({}))
    await flushTelemetry()
    expect(flushMock).not.toHaveBeenCalled()
  })
})
