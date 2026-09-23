# Sleekdo

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/sleekdo.svg)](https://badge.fury.io/js/sleekdo)
[![GitHub Actions](https://github.com/Deexv/sleekdo/workflows/Build%20and%20Release/badge.svg)](https://github.com/Deexv/sleekdo/actions)

**Sleekdo is an agent orchestration and verification system for autonomous software development.** It enables coding CLI agents to build, modify, debug, test, refactor, and complete software projects of arbitrary size and domain.

## Features

- **Batch-review model** — Tasks are executed first, then reviewed in a single end-of-run batch with synthetic per-task reviews
- **Command cache** — Memoizes tool-call results to reduce redundant operations and improve performance
- **Live agent streaming** — Tool calls, markdown-formatted narration, and idle loaders in real-time
- **Progress tracking** — Executed-but-unreviewed tasks count toward progress so the bar reflects real work
- **Design/anti-AI-slop review** — Explicit checks for emoji-stuffed headers, lorem ipsum, generic gradients
- **Raw-mode input** — Claude Code-style always-closed input box with history and tab completion
- **Zero-repository-clone installer** — Install with a single command without cloning the repository

## Installation

### Quick Install (Recommended)

```bash
npm install -g sleekdo
```

### Alternative: Zero-Repository-Clone Installer

```bash
curl -fsSL https://github.com/Deexv/sleekdo/raw/main/install.sh | sh
```

This installer automatically detects your OS and architecture (Linux x64, Linux arm64, macOS arm64, macOS x64, Windows x64), downloads the appropriate binary from GitHub Releases, and adds it to your PATH.

### Linux Installation

```bash
# Using npm
npm install -g sleekdo

# Or using curl
curl -fsSL https://github.com/Deexv/sleekdo/raw/main/install.sh | sh

# Verify installation
sleekdo --help
```

### macOS Installation

```bash
# Using npm
npm install -g sleekdo

# Or using curl
curl -fsSL https://github.com/Deexv/sleekdo/raw/main/install.sh | sh

# Verify installation
sleekdo --help
```

### Windows Installation

```powershell
# Using npm
npm install -g sleekdo

# Or using PowerShell
Invoke-WebRequest -Uri "https://github.com/Deexv/sleekdo/raw/main/install.ps1" -OutFile "install.ps1"
.\install.ps1
```

## Usage

### Start the Interactive Terminal

```bash
# With Pi CLI backend (recommended)
sleekdo --pi

# With Claude Code backend
sleekdo --claude

# With Google Antigravity (Agy) backend
sleekdo --agy
```

### Enter Your Objective

Type what you want to build when prompted:

```
> Create a complete REST API with authentication, SQLite storage, tests, and rate limiting.
```

Sleekdo plans the work, validates the plan with A3 Reviewer, and displays the task roadmap.

### Interactive Commands

Inside the interactive prompt (`sleekdo>`), use these commands:

| Command | Action |
|---------|--------|
| `run` | Starts the autonomous implementation and verification cycle |
| `status` | Displays live status, task counts, requirement progress, and blocked tasks |
| `tasks` | Displays the task tree with status symbols (`✓` approved, `→` in progress, `○` ready/pending, `✗` rejected/blocked) |
| `plan` | Prints the current plan version, original objective, and requirement breakdown |
| `review <taskId>` | Shows the A3 review verdict and evidence for a specific task |
| `retry <taskId>` | Resets a rejected or blocked task to `READY` state |
| `pause` | Gracefully pauses execution after current task boundary |
| `resume` | Resumes paused execution |
| `logs` | Displays recent audit events |
| `clean` | Runs dead-code, dead-file, and dependency analysis |
| `verify` | Runs final 13-criteria system verification |
| `/lockin` | Lock in the current objective and skip A3 plan review for faster refinement |
| `/lockin <objective>` | Update the objective and skip A3 plan review |
| `exit` or `quit` | Closes the interactive session |

### Batch Mode Workflow

For headless scripting:

```bash
# Initialize project with your prompt
sleekdo init "Create a high-performance REST API with authentication"

# Run the orchestrator loop to completion
sleekdo run

# Inspect live progress and requirement coverage
sleekdo status

# Run system verification
sleekdo verify
```

## Architecture

Sleekdo organizes work around three logical AI roles coordinated by an authoritative orchestrator:

### A1 Worker

Executes implementation, coding, test writing, and bug fixing tasks. Receives only authorized task definitions and local scope.

### A2 Planner

Understands the user objective, decomposes it into dependency-ordered tasks, discovers newly required work, and maintains the global roadmap.

### A3 Reviewer

Independently verifies completed work in fresh sessions using observable evidence from the workspace.

### Key Invariants

- A1 performs work
- A2 determines what work must exist
- A3 independently determines whether completed work is correct
- The Sleekdo orchestrator controls what work proceeds
- No agent approves its own output
- No agent skips validation gates

## Documentation

- [Full README](https://github.com/Deexv/sleekdo/blob/main/README.md) - Detailed installation, usage, and architecture
- [CLI Reference](https://github.com/Deexv/sleekdo/blob/main/docs/CLI_REFERENCE.md) - Complete command reference
- [Architecture Guide](https://github.com/Deexv/sleekdo/blob/main/docs/ARCHITECTURE.md) - System design and subsystems
- [CLI Agent Guide](https://github.com/Deexv/sleekdo/blob/main/docs/CLI_AGENT_GUIDE.md) - Step-by-step setup for Pi CLI, Claude Code, and Agy

## Prerequisites

- Node.js 18 or higher
- npm
- One of the supported coding agents:
  - [Pi CLI](https://github.com/earendil-works/pi-coding-agent) (recommended)
  - [Claude Code](https://github.com/anthropics/claude-code)
  - [Google Antigravity (Agy)](https://antigravity.dev/)

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Sleekdo Contributors

## Links

- [GitHub Repository](https://github.com/Deexv/sleekdo)
- [GitHub Releases](https://github.com/Deexv/sleekdo/releases)
- [Issues](https://github.com/Deexv/sleekdo/issues)
- [Documentation](https://github.com/Deexv/sleekdo/tree/main/docs)

## Keywords

agent orchestration, autonomous software development, AI coding assistant, code review, batch review, command cache, live streaming, Pi CLI, Claude Code, Antigravity, zero-repository-clone installer, software development lifecycle

---

**Sleekdo** helps you build better software faster with autonomous AI agents and rigorous verification.

*Built with ❤️ for the open-source community*
