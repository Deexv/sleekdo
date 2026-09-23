# Sleekdo

Sleekdo is an agent orchestration and verification system. It enables coding CLI agents to autonomously build, modify, debug, test, refactor, and complete software projects of arbitrary size and domain.

Sleekdo sits above coding CLI agents. Compatible agents include Pi, Claude Code, Antigravity (Agy), and arbitrary command line agents. Sleekdo does not replace the coding agent. It controls the development lifecycle around the coding agent.

## Architectural model

Sleekdo organizes work around three logical AI roles coordinated by an authoritative orchestrator:

- **A1 Worker.** Executes implementation, coding, test writing, and bug fixing tasks.
- **A2 Planner.** Understands the user objective, decomposes it into dependency ordered work, continuously reassesses progress, discovers newly required tasks, and maintains the global roadmap.
- **A3 Reviewer.** Independently verifies completed work in a fresh, isolated session using direct observable evidence from the workspace.

The central invariant governs all operations. A1 performs work. A2 determines what work must exist. A3 independently determines whether completed work is correct. The Sleekdo orchestrator controls what work proceeds. No agent approves its own output. No agent skips validation gates.

## Quick start

### Prerequisites

- Node.js 18 or higher.
- npm.
- At least one installed coding CLI agent, such as Pi CLI, Claude Code, or Agy.

### Installation and build

Clone the repository and install dependencies:

```bash
git clone https://github.com/Deexv/sleekdo.git
cd sleekdo
npm install
npm run build
```

Link the executable globally or run through Node.js:

```bash
npm link
sleekdo --help
```

### Native interactive mode (Section 97)

Per PRD Section 97, Sleekdo provides an interactive terminal session where Sleekdo owns the user-facing UI while controlling external agent CLIs as headless backends:

```bash
# Launch with Pi CLI backend
sleekdo --pi
sleekdo pi

# Launch with Google Antigravity backend
sleekdo --agy
sleekdo agy

# Launch with Claude Code backend
sleekdo --claude
sleekdo claude
```

### Basic batch workflow

1. Initialize a new project with your objective:

```bash
sleekdo init "Create a high-performance REST API with authentication and rate limiting"
```

2. Execute the autonomous development cycle:

```bash
sleekdo run
```

3. Check live progress and requirement coverage:

```bash
sleekdo status
```

## CLI summary

The table below summarizes the primary CLI commands. For complete flag definitions and behaviors, see the [CLI reference guide](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/docs/CLI_REFERENCE.md).

| Command | Action |
| --- | --- |
| `sleekdo init <objective>` | Initializes project storage and records primary objective |
| `sleekdo run` | Executes the recursive autonomous development lifecycle |
| `sleekdo status` | Prints state, requirement matrix, tasks, and active leases |
| `sleekdo verify` | Runs system verification across tests, git state, and dead code |
| `sleekdo clean` | Scans for unreferenced code, dead files, and unused dependencies |
| `sleekdo replan` | Forces A2 Planner to perform a global project reassessment |
| `sleekdo pause` | Gracefully pauses execution after current task boundary |
| `sleekdo resume` | Resumes execution from persisted state |
| `sleekdo override <id> <verdict>` | Overrides review verdict with audit logging |
| `sleekdo clarify <id> <answer>` | Answers an agent clarification question |
| `sleekdo inspect <taskId>` | Prints full diagnostic details for a specific task |

## Documentation index

Deep architectural guides, adapter integrations, and requirements traceability reside in the `docs/` folder:

- **[Connecting CLI agents](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/docs/CLI_AGENT_GUIDE.md).** Step-by-step setup for Pi CLI, Claude Code, Google Antigravity (Agy), Python scripts, shell wrappers, argument templates, and mixed per-role setups.
- **[CLI reference](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/docs/CLI_REFERENCE.md).** Complete reference for every CLI command, flag, and runtime option.
- **[Architecture and subsystems](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/docs/ARCHITECTURE.md).** Detailed reference covering the storage layer, orchestrator, state machine, evidence engines, investigation system, and AST analyzers.
- **[PRD section traceability](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/docs/PRD_TRACEABILITY.md).** Individual section-by-section breakdown mapping all 97 PRD sections to source files, invariants, and automated verification tests.

## Running tests

Sleekdo provides automated verification across multiple test tiers:

```bash
# Run unit and integration test suite
npm test

# Run live end-to-end suite against installed Pi CLI
npm run test:e2e

# Run all test suites
npm run test:all
```
