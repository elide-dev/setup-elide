
# GitHub Action: Setup Elide

[![Elide](https://elide.dev/shield)](https://elide.dev)
[![CI](https://github.com/elide-dev/setup-elide/actions/workflows/ci.yml/badge.svg)](https://github.com/elide-dev/setup-elide/actions)
[![Coverage](./.github/badges/coverage.svg)](https://codecov.io/gh/elide-dev/setup-elide)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v1.4-ff69b4.svg)](.github/CODE_OF_CONDUCT.md)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Felide-dev%2Fsetup-elide.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2Felide-dev%2Fsetup-elide?ref=badge_shield&issueType=license)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=elide-dev_setup-elide&metric=reliability_rating&token=96b4edd8d390591aa7b096d919983e1c1d42cba9)](https://sonarcloud.io/summary/new_code?id=elide-dev_setup-elide)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=elide-dev_setup-elide&metric=security_rating&token=96b4edd8d390591aa7b096d919983e1c1d42cba9)](https://sonarcloud.io/summary/new_code?id=elide-dev_setup-elide)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=elide-dev_setup-elide&metric=sqale_rating&token=96b4edd8d390591aa7b096d919983e1c1d42cba9)](https://sonarcloud.io/summary/new_code?id=elide-dev_setup-elide)


This repository provides a [GitHub Action][0] to setup the [Elide][1] runtime within your workflows.

## Usage

**Install the latest Elide version and add it to the `PATH`**
```yaml
  - name: "Setup: Elide"
    uses: elide-dev/setup-elide@v1
```

**Install a specific Elide version and add it to the `PATH`**
```yaml
  - name: "Setup: Elide"
    uses: elide-dev/setup-elide@v1
    with:
      version: 1.0.0-alpha7  # any tag from the `elide-dev/releases` repo
```

**Install Elide but don't add it to the `PATH`**
```yaml
  - name: "Setup: Elide"
    uses: elide-dev/setup-elide@v1
    with:
      export_path: false
```

## Options

The full suite of available options are below.

| Option        | Type         | Default                   | Description                                  |
| ------------- | ------------ | ------------------------- | -------------------------------------------- |
| `version`     | `string`     | `latest`                  | Version to install; defaults to `latest`     |
| `os`          | `string`     | (Current)                 | OS to target; defaults to current platform   |
| `arch`        | `string`     | (Current)                 | Arch to target; defaults to current platform |
| `force`       | `boolean`    | `false`                   | Force installation over existing binary      |
| `prewarm`     | `boolean`    | `true`                    | Warm up the runtime after installing         |
| `selftest`    | `boolean`    | `true`                    | Perform a self-test after installing         |
| `token`       | `string`     | `${{ env.GITHUB_TOKEN }}` | GitHub token to use for fetching assets      |
| `export_path` | `boolean`    | `true`                    | Whether to install Elide onto the `PATH`     |

**Options for `os`** (support varies)
- `darwin`, `mac`, `macos`
- `windows`, `win32`
- `linux`

**Options for `arch`** (support varies)
- `amd64`, `x64`, `x86_64`
- `arm64`, `aarch64`

**Full configuration sample with defaults**
```yaml
  - name: "Setup: Elide"
    uses: elide-dev/setup-elide@v1
    with:
      version: latest
      os: linux
      arch: amd64
      force: false
      prewarm: true
      seltest: true
      export_path: true
```

## What is Elide?

Elide is a new runtime and framework designed for the polyglot era. Mix and match languages including JavaScript, Python, Ruby, and JVM, with the ability to share objects between them. It's fast: Elide can execute Python at up to 3x the speed of CPython, Ruby at up to 22x vs. CRuby, and JavaScript at up to 75x the speed of Node. Elide already beats Node, Deno, and Bun under benchmark.

- **Visit [elide.dev][1]**, our website, which runs on Elide
- **Watch the [launch video][2]** for demos, benchmarks, and a full feature tour
- **Join the devs on [Discord][3]**, we are always open to new ideas and feedback

[0]: https://github.com/features/actions
[1]: https://elide.dev
[2]: https://www.youtube.com/watch?v=Txl9ryfbCw4
[3]: https://elide.dev/discord
