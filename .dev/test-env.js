const path = require('path')

process.env.RUNNER_TOOL_CACHE = path.resolve(
    __dirname,
    'tool-cache'
)
process.env.RUNNER_TEMP = path.resolve(
    __dirname,
    'tmp'
)
process.env.ELIDE_HOME = path.resolve(
    __dirname,
    'target'
)
