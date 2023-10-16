
# GitHub Action: Setup Elide

[![Linter](https://github.com/elide-dev/setup-elide/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/elide-dev/setup-elide/actions/workflows/ci.yml/badge.svg)
![Coverage](./badges/coverage.svg)

This repository provides a [GitHub Action][0] to setup the [Elide][1] runtime within your workflows.

## Usage

**Install the latest Elide version and add it to the `PATH`:**
```yaml
  - name: "Setup: Elide"
    uses: elide-dev/setup-elide@v1
```

**Install a specific Elide version and add it to the `PATH`:**
```yaml
  - name: "Setup: Elide"
    uses: elide-dev/setup-elide@v1
    with:
      version: 1.0.0-alpha7  # any tag from the `elide-dev/releases` repo
```

**Install Elide but don't add it to the `PATH`:**
```yaml
  - name: "Setup: Elide"
    uses: elide-dev/setup-elide@v1
    with:
      export_path: false
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

