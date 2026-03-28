/**
 * Post-step entry point.
 * Flushes any pending telemetry events before the action exits.
 */
import { flushTelemetry } from './telemetry'

flushTelemetry()
