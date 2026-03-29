
# GitHub Action: Setup Elide

[![Elide](https://elide.dev/shield)](https://elide.dev)
[![CI](https://github.com/elide-dev/setup-elide/actions/workflows/ci.yml/badge.svg)](https://github.com/elide-dev/setup-elide/actions)
[![codecov](https://codecov.io/gh/elide-dev/setup-elide/graph/badge.svg)](https://codecov.io/gh/elide-dev/setup-elide)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v1.4-ff69b4.svg)](.github/CODE_OF_CONDUCT.md)

This repository provides a [GitHub Action][0] to install the [Elide][1] runtime within your workflows.

## Quick Start

```yaml
- name: "Setup: Elide"
  uses: elide-dev/setup-elide@v4
```

This installs the latest nightly build of Elide and adds it to the `PATH`.

## Usage Examples

**Install a specific version**
```yaml
- name: "Setup: Elide"
  uses: elide-dev/setup-elide@v4
  with:
    version: 1.0.0
    channel: release
```

**Install via apt on Debian/Ubuntu**
```yaml
- name: "Setup: Elide"
  uses: elide-dev/setup-elide@v4
  with:
    installer: apt
```

**Install via shell script (uses GitHub Releases for faster downloads in GHA)**
```yaml
- name: "Setup: Elide"
  uses: elide-dev/setup-elide@v4
  with:
    installer: shell
```

**Install via PKG on macOS**
```yaml
- name: "Setup: Elide"
  uses: elide-dev/setup-elide@v4
  with:
    installer: pkg
```

**Install without adding to PATH**
```yaml
- name: "Setup: Elide"
  uses: elide-dev/setup-elide@v4
  with:
    export_path: false
```

**Use outputs in subsequent steps**
```yaml
- name: "Setup: Elide"
  id: setup-elide
  uses: elide-dev/setup-elide@v4

- name: "Check"
  run: |
    echo "Installed: ${{ steps.setup-elide.outputs.version }}"
    echo "Path: ${{ steps.setup-elide.outputs.path }}"
    echo "Cached: ${{ steps.setup-elide.outputs.cached }}"
    echo "Installer: ${{ steps.setup-elide.outputs.installer }}"
```

## Inputs

| Input | Type | Default | Description |
|---|---|---|---|
| `version` | `string` | `latest` | Version to install, or `latest` for the newest release |
| `channel` | `string` | `nightly` | Release channel: `nightly`, `preview`, or `release` |
| `installer` | `string` | `archive` | Installation method (see [Installers](#installers) below) |
| `os` | `string` | _(auto)_ | Target OS override |
| `arch` | `string` | _(auto)_ | Target architecture override |
| `install_path` | `string` | _(conventional)_ | Custom install directory |
| `force` | `boolean` | `false` | Force installation even if Elide is already installed |
| `export_path` | `boolean` | `true` | Add Elide to the `PATH` |
| `no_cache` | `boolean` | `false` | Disable the GitHub Actions tool cache |
| `telemetry` | `boolean` | `true` | Enable anonymous error telemetry ([details](#telemetry)) |
| `token` | `string` | `${{ github.token }}` | GitHub token for API requests |
| `custom_url` | `string` | | Custom download URL (overrides all other download logic) |
| `version_tag` | `string` | | Version tag to use with a custom download URL |

## Outputs

| Output | Description |
|---|---|
| `path` | Path to the installed Elide binary |
| `version` | Installed version string |
| `cached` | `true` if the installation was served from the tool cache |
| `installer` | The effective installer method that was used |

## Installers

The `installer` input controls how Elide is installed. The default (`archive`) downloads a prebuilt archive from the Elide CDN and caches it using the GitHub Actions tool cache.

| Installer | Platforms | Description |
|---|---|---|
| `archive` | All | Download and extract a `.tgz`/`.txz`/`.zip` archive (default) |
| `shell` | All | Run the official install script (`install.sh` or `install.ps1`) |
| `apt` | Linux (Debian/Ubuntu) | Install via the Elide apt repository |
| `rpm` | Linux (RHEL/Fedora) | Install via `.rpm` package |
| `pkg` | macOS | Install via `.pkg` installer |
| `msi` | Windows | Install via `.msi` installer |

If you choose an installer that doesn't match your platform (e.g., `msi` on Linux), the action will warn and fall back to `archive`.

## Supported Platforms

| Platform | Architectures |
|---|---|
| Linux | `amd64`, `aarch64` |
| macOS | `amd64`, `aarch64` |
| Windows | `amd64` |

**OS aliases:** `darwin`, `mac`, `macos`, `windows`, `win`, `win32`, `linux`
**Arch aliases:** `amd64`, `x64`, `x86_64`, `aarch64`, `arm64`

## Caching

The `archive` installer uses the [GitHub Actions tool cache][4] to avoid re-downloading on subsequent runs. Cache keys are scoped by version and architecture. Set `no_cache: true` to disable caching.

## Telemetry

This action sends anonymous error telemetry to help the Elide team detect and fix issues at scale. **No secrets, tokens, environment variables, or personally identifiable information are ever transmitted.** Only the error message (scrubbed of sensitive values), stack trace, and action configuration (installer, os, arch, channel, version) are sent.

To opt out:
```yaml
- uses: elide-dev/setup-elide@v4
  with:
    telemetry: false
```

## GitHub Integration

This action uses GitHub Actions features to provide a polished CI experience:

- **Grouped log output** -- Installation phases are wrapped in collapsible log groups
- **Job summary** -- A summary table is written to the Actions Summary tab showing version, platform, installer, timing, and cache status
- **Annotations** -- Errors and warnings appear as titled annotations in the Actions UI
- **Rich outputs** -- Downstream steps can branch on `cached`, `installer`, `version`, and `path`

## What is Elide?

Elide is a new runtime and framework designed for the polyglot era. Mix and match languages including JavaScript, Python, Ruby, and JVM, with the ability to share objects between them. It's fast: Elide can execute Python at up to 3x the speed of CPython, Ruby at up to 22x vs. CRuby, and JavaScript at up to 75x the speed of Node.

- **Visit [elide.dev][1]**, our website, which runs on Elide
- **Watch the [launch video][2]** for demos, benchmarks, and a full feature tour
- **Join the devs on [Discord][3]**, we are always open to new ideas and feedback

## License

[MIT](.github/LICENSE)

[0]: https://github.com/features/actions
[1]: https://elide.dev
[2]: https://www.youtube.com/watch?v=Txl9ryfbCw4
[3]: https://elide.dev/discord
[4]: https://github.com/actions/toolkit/tree/main/packages/tool-cache
