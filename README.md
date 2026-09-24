# Sleekdo

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/sleekdo.svg)](https://badge.fury.io/js/sleekdo)
[![GitHub Actions](https://github.com/Deexv/sleekdo/workflows/Build%20and%20Release/badge.svg)](https://github.com/Deexv/sleekdo/actions)

**Sleekdo is an agent orchestration and verification system for autonomous software development.** It enables coding CLI agents to build, modify, debug, test, refactor, and complete software projects of arbitrary size and domain.

## Two-Namespace Command Architecture

Sleekdo enforces a deterministic two-namespace interaction model:

```text
//<command>     -> Sleekdo authority commands
/<command>      -> Connected CLI harness (passed through without allowlists)
<prompt>        -> Connected CLI harness (or project objective initialization)
!<shell>        -> Local shell execution
```

- **`//` Namespace (Sleekdo)**: Reserved exclusively for Sleekdo orchestration, task status, inspection, and verification gates.
- **`/` Namespace (Connected CLI)**: Passed through directly to the connected coding agent harness (Pi, Claude Code, Antigravity). Commands are **never restricted by a hard-coded allowlist**. If a provider adds `/new-feature`, it works immediately in Sleekdo.

### Available Sleekdo Authority Commands (`//`)

| Command | Action |
|---------|--------|
| `//run` | Executes autonomous implementation and verification cycle to completion |
| `//status` | Displays live status, task counts, requirement progress, and blocked tasks |
| `//tasks` | Displays the task tree with status symbols (`✓` approved, `→` in progress, `○` ready/pending, `✗` rejected/blocked) |
| `//plan` | Prints the active plan version, original objective, and requirement breakdown |
| `//review <taskId>` | Shows the A3 independent review verdict and evidence for a specific task |
| `//retry <taskId>` | Resets a rejected or blocked task to `READY` state |
| `//pause` | Gracefully pauses execution after current task boundary |
| `//resume` | Resumes paused execution |
| `//logs` | Displays recent audit events from the immutable event store |
| `//clean` | Runs dead-code, dead-file, and unused dependency analysis sweeps |
| `//verify` | Runs full multi-criteria system verification against all requirements |
| `//lsp [status\|diag]` | Inspects Language Server Protocol status and active diagnostics |
| `//dap [status]` | Inspects Debug Adapter Protocol debugging sessions and breakpoints |
| `//hashline [status]` | Inspects Hashline edit engine status and active snapshots |
| `//provider` | Displays connected provider details and session capabilities |
| `//session` | Displays workspace directory, state revision, and artifact storage |
| `//exit` or `//quit` | Closes the interactive session |

*Note: In interactive mode, typing bare commands such as `status`, `plan`, `run`, or `help` also executes the corresponding Sleekdo command for convenience.*

## Advanced Developer Tooling

Sleekdo integrates developer tooling adapted from the proven techniques of **Oh My Pi**:

### 1. Language Server Protocol (LSP)
- **JSON-RPC Framing**: Robust content-length header framing supporting streaming and chunked responses.
- **Multi-Server Detection**: Auto-detects and launches language servers for TypeScript/JavaScript (`typescript-language-server`), Python (`pyright`, `pylsp`), Rust (`rust-analyzer`), Go (`gopls`), and JSON.
- **Diagnostics Ledger**: Deduplicates and tracks diagnostic reports across files to provide verifiable compile-time evidence for A1 Worker implementation and A3 Reviewer verification.

### 2. Debug Adapter Protocol (DAP)
- **Real Debugger Transport**: Full DAP client supporting launch, attach, breakpoints, conditional breakpoints, stepping, stack traces, variable scopes, and expression evaluation.
- **Evidence-Driven Debugging**: Captures runtime stack frames and variables as structured `DapRuntimeEvidence`, replacing guesswork with empirical hypothesis elimination.

### 3. Hashline Edit Engine
- **Stale-Edit Protection**: Computes stable 4-hex SHA-256 hashes per line; automatically rejects stale edits if the target file has diverged.
- **Atomic Preflight**: Validates all sections in a multi-part patch before writing to disk, preventing partial or corrupted file state.
- **Encoding & Line Ending Normalization**: Seamlessly handles CRLF line endings and UTF-8 Byte Order Marks (BOM).

### 4. Search, Code Intelligence & Runtime Tools
- **Structured Search**: Fast file globbing respecting `.gitignore`, grep search with configurable context lines, and structured range reads with outline views.
- **AST Code Intelligence**: Parses TypeScript ASTs to extract function signatures and class definitions.
- **Persistent Process Manager**: Manages long-lived background tasks and dev servers with output streaming and graceful termination.
- **Content-Addressed Blob Storage**: Deduplicates and externalizes large command outputs and tool payloads outside core state JSONL files.

## Features

- **Authoritative A1/A2/A3 Model** — A1 Worker implements, A2 Planner decomposes and reassesses, A3 independently verifies with fresh sessions
- **Strict Two-Namespace Router** — `//` for Sleekdo authority, `/` for open connected CLI commands
- **Batch-review model** — Tasks are executed, then reviewed in an end-of-run batch with individual synthetic reviews
- **Command cache** — Memoizes tool-call results to reduce redundant operations
- **Live agent streaming** — Tool calls, markdown-formatted narration, and idle loaders in real-time
- **Workspace isolation** — Worker agents are strictly barred from modifying Sleekdo control files (`.sleekdo/`)
- **Self-healing crash recovery** — Recovers interrupted tasks and heals stale locks from dead process IDs
- **Zero-repository-clone installer** — Install with a single command without cloning the repository

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

### Third-Party Notices & Attribution

Developer tooling mechanisms, including LSP framing, DAP debugging structures, and Hashline snapshot logic, are adapted under the MIT License from [Oh My Pi](https://github.com/can1357/oh-my-pi) by Mario Zechner, Can Bölük, and Stencil Labs. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) for full attribution.

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
