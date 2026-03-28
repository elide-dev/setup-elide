import * as Sentry from '@sentry/node'
import type { Event } from '@sentry/node'
import type { ElideSetupActionOptions } from './options'

// Public DSN — not a secret. Only allows sending events, not reading them.
const SENTRY_DSN =
  'https://b5a33745f4bf36a0f1e66dbcfceaa898@o4510814125228032.ingest.us.sentry.io/4511124523974656'

const ACTION_VERSION = '1.0.0'

let telemetryEnabled = false

// Environment variable patterns that could contain secrets.
const SENSITIVE_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /key/i,
  /credential/i,
  /auth/i,
  /^GITHUB_/i,
  /^AWS_/i,
  /^AZURE_/i,
  /^GCP_/i,
  /^NPM_/i,
  /^NODE_AUTH/i
]

/**
 * Scrub a string of any values that look like they came from sensitive env vars.
 * Replaces any known env var value found in the string with [REDACTED].
 */
function scrubEnvVars(input: string): string {
  let result = input
  for (const [key, value] of Object.entries(process.env)) {
    if (!value || value.length < 8) continue
    if (SENSITIVE_PATTERNS.some(p => p.test(key))) {
      result = result.replaceAll(value, '[REDACTED]')
    }
  }
  return result
}

/**
 * Scrub an entire Sentry event of sensitive data.
 */
function scrubEvent(event: Event): Event {
  // Strip fields that could leak environment info
  delete event.server_name
  delete event.extra
  delete event.user
  delete event.request
  event.contexts = {}
  event.breadcrumbs = []

  // Scrub exception messages of env var values
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) {
        ex.value = scrubEnvVars(ex.value)
      }
    }
  }

  // Scrub top-level message
  if (event.message) {
    event.message = scrubEnvVars(event.message)
  }

  return event
}

/**
 * Initialize Sentry telemetry with aggressive scrubbing.
 * No environment data, no PII, no secrets — only the error and action config tags.
 */
export function initTelemetry(
  enabled: boolean,
  options: ElideSetupActionOptions
): void {
  telemetryEnabled = enabled
  if (!enabled) return

  Sentry.init({
    dsn: SENTRY_DSN,
    defaultIntegrations: false,
    environment: options.channel,
    release: `setup-elide@${ACTION_VERSION}`,
    beforeSend(event) {
      return scrubEvent(event)
    }
  })

  Sentry.setTags({
    installer: options.installer,
    os: options.os,
    arch: options.arch,
    channel: options.channel,
    version: options.version,
    action_version: ACTION_VERSION
  })
}

/**
 * Report an error to Sentry with optional additional tags.
 */
export function reportError(
  err: Error,
  context?: Record<string, string>
): void {
  if (!telemetryEnabled) return

  Sentry.withScope(scope => {
    if (context) {
      for (const [k, v] of Object.entries(context)) {
        scope.setTag(k, v)
      }
    }
    Sentry.captureException(err)
  })
}

/**
 * Flush pending Sentry events. Call before process exit.
 */
export async function flushTelemetry(): Promise<void> {
  if (!telemetryEnabled) return
  await Sentry.flush(2000)
}
