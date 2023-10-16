/**
 * Models the shape of outputs provided by the setup action.
 */
export type ElideSetupActionOutputs = {
  // Path to the Elide binary.
  path: string

  // Version number for the binary.
  version: string
}

/**
 * Enumerates outputs and maps them to their well-known names.
 */
export enum ActionOutputName {
  // Path to the Elide binary.
  PATH = 'path',

  // Path to the Elide binary.
  VERSION = 'version'
}
