
# Development

Local development helpers for the `setup-elide` action.

## Prerequisites

- [Bun](https://bun.sh) (latest)
- [Node.js](https://nodejs.org) 24+
- [Docker](https://docs.docker.com/get-docker/) (for `test:docker`)

## Quick Reference

```bash
bun install              # install dependencies
bun run build            # format + bundle (dist/index.js + dist/post.js)
bun run test             # run all unit tests (sequenced batches)
bun run test:ci          # same as test, but produces JUnit XML + merged lcov
bun run test:docker      # build + test in Docker container
bun run lint             # oxlint
bun run format:check     # biome format check
bun run format:write     # biome format + write
bun run all              # format + build + test
```

## Directory Layout

| Path | Purpose |
|---|---|
| `.dev/test-env.ts` | Preloaded by bun test to set `RUNNER_TEMP`, `RUNNER_TOOL_CACHE`, `ELIDE_HOME` |
| `.dev/tmp/` | Temp files created during test runs |
| `.dev/target/` | Simulated `ELIDE_HOME` for tests |
| `.dev/tool-cache/` | Simulated tool cache for tests |

## Test Batching

Tests run in sequenced batches because `bun:test`'s `mock.module()` creates
process-wide module replacements. Test files that mock the same module differently
must run in separate `bun test` invocations. The `test` script in `package.json`
handles this automatically.

## Architecture

See the [main README](../README.md) for user-facing documentation. Key source files:

| File | Role |
|---|---|
| `src/index.ts` | Entry point (calls `run()`) |
| `src/post.ts` | Post-step entry point (flushes telemetry) |
| `src/main.ts` | Orchestrator: option parsing, installer routing, outputs, summary |
| `src/options.ts` | Option types, defaults, normalization, validation, input parsing |
| `src/releases.ts` | CDN URL building, archive download/extract, tool cache, GitHub API |
| `src/command.ts` | Elide CLI interaction (`elide info`, `elide --version`) |
| `src/platform.ts` | Platform detection (`isDebianLike`, `isRpmBased`) |
| `src/telemetry.ts` | Sentry init/report/flush with aggressive scrubbing |
| `src/install-apt.ts` | apt installer |
| `src/install-shell.ts` | bash/PowerShell install script runner |
| `src/install-msi.ts` | Windows MSI installer |
| `src/install-pkg.ts` | macOS PKG installer |
| `src/install-rpm.ts` | Linux RPM installer |
