# Sleekdo

An agent orchestration and verification system for autonomous software development. Sleekdo coordinates three logical AI roles (Worker, Planner, Reviewer) to build, modify, debug, test, refactor, and complete software projects of arbitrary size and domain.

## Installation

### Quick install

```bash
npm install -g sleekdo
```

Or with a zero-repository-clone installer:

```bash
curl -fsSL https://sleekdo.dev/install.sh | sh
```

Both install Sleekdo globally to your PATH and verify the installation.

### Prerequisites

- Node.js 18 or higher
- npm
- One of the supported coding agents:
  - [Pi CLI](https://github.com/earendil-works/pi-coding-agent) (recommended)
  - [Claude Code](https://github.com/anthropics/claude-code)
  - [Google Antigravity (Agy)](https://antigravity.dev/)

## Usage

Start the interactive terminal with your chosen agent:

```bash
sleekdo --pi
sleekdo --claude
sleekdo --agy
```

Then describe your project:

```text
> Create a complete REST API with authentication, SQLite storage, tests, and rate limiting.
```

Sleekdo plans the work, validates the plan with A3 Reviewer, and displays the task roadmap.

## Features

- **Batch-review model** — Tasks are executed, then reviewed in a single end-of-run batch
- **Progress tracking** — Executed-but-unreviewed tasks count toward progress
- **Command cache** — Memoizes tool-call results to reduce redundant operations
- **Live agent streaming** — Tool calls, markdown-formatted narration, idle loaders
- **Design/anti-AI-slop review** — Explicit checks for generic visual flourishes
- **Raw-mode input** — Claude Code-style always-closed input box
- **Zero-repository-clone installer** — Install with a single command

## Documentation

- [Full README](https://github.com/Deexv/sleekdo/blob/main/README.md) — Detailed installation, usage, and architecture
- [CLI Reference](https://github.com/Deexv/sleekdo/blob/main/docs/CLI_REFERENCE.md) — Complete command reference
- [Architecture Guide](https://github.com/Deexv/sleekdo/blob/main/docs/ARCHITECTURE.md) — System design and subsystems

## Development

```bash
# Clone the repository
git clone https://github.com/Deexv/sleekdo.git
cd sleekdo

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Link globally for development
npm link
```

## License

MIT License — see [LICENSE](LICENSE) for details.
