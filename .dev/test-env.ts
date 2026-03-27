import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

if (!process.env.RUNNER_TEMP) {
  process.env.RUNNER_TOOL_CACHE = path.resolve(__dirname, 'tool-cache')
  process.env.RUNNER_TEMP = path.resolve(__dirname, 'tmp')
  process.env.ELIDE_HOME = path.resolve(__dirname, 'target')
}
