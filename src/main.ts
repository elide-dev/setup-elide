import * as core from '@actions/core'
import { ActionOutputName, ElideSetupActionOutputs } from './outputs'
import buildOptions, { OptionName, ElideSetupActionOptions } from './options'
import { downloadRelease } from './releases'

function stringOption(
  option: string,
  defaultValue?: string
): string | undefined {
  const value: string = core.getInput(option)
  core.debug(`Property value: ${option}=${value || defaultValue}`)

  if (!value) {
    return defaultValue || undefined
  }
  return value
}

function booleanOption(option: string, defaultValue: boolean): boolean {
  const value: boolean = core.getBooleanInput(option)
  if (value !== null && value !== undefined) {
    return value
  }
  return defaultValue
}

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    // resolve effective plugin options
    const effectiveOptions: ElideSetupActionOptions = buildOptions({
      version: stringOption(OptionName.VERSION, 'latest'),
      os: stringOption(OptionName.OS),
      arch: stringOption(OptionName.ARCH),
      export_path: booleanOption(OptionName.EXPORT_PATH, true),
      custom_url: stringOption(OptionName.CUSTOM_URL)
    })

    // download the release tarball (resolving version if needed)
    const release = await downloadRelease(effectiveOptions)

    // if instructed, add Elide to the path
    if (effectiveOptions.export_path) {
      core.addPath(release.elideBin)
    }

    // begin preparing outputs
    const outputs: ElideSetupActionOutputs = {
      path: release.elidePath,
      version: effectiveOptions.version
    }

    // mount outputs
    core.setOutput(ActionOutputName.PATH, outputs.path)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
