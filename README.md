# Sleekdo

Sleekdo is an agent orchestration and verification system. It enables coding CLI agents to autonomously build, modify, debug, test, refactor, and complete software projects of arbitrary size and domain.

Sleekdo sits above coding CLI agents. Compatible agents include Pi, Claude Code, Antigravity (Agy), and arbitrary command line agents. Sleekdo does not replace the coding agent. It controls the development lifecycle around the coding agent.

## Architectural model

Sleekdo organizes work around three logical AI roles coordinated by an authoritative orchestrator:

- **A1 Worker.** Executes implementation, coding, test writing, and bug fixing tasks.
- **A2 Planner.** Understands the user objective, decomposes it into dependency ordered work, continuously reassesses progress, discovers newly required tasks, and maintains the global roadmap.
- **A3 Reviewer.** Independently verifies completed work in a fresh, isolated session using direct observable evidence from the workspace.

The central invariant governs all operations. A1 performs work. A2 determines what work must exist. A3 independently determines whether completed work is correct. The Sleekdo orchestrator controls what work proceeds. No agent approves its own output. No agent skips validation gates.

## Installation on a new computer

### 1. Install prerequisites

Ensure you have Node.js 18 or higher, npm, and git installed.

Install at least one coding agent backend globally on your computer:

- **Pi CLI (recommended):**
  ```bash
  npm install -g @earendil-works/pi-coding-agent
  ```
  Configure your model provider in Pi before running Sleekdo.

- **Claude Code:**
  ```bash
  npm install -g @anthropic-ai/claude-code
  export ANTHROPIC_API_KEY="your-api-key"
  ```

- **Google Antigravity (Agy):**
  Install the `agy` CLI binary and ensure it is available in your PATH.

### 2. Clone and install Sleekdo

Clone the repository and compile the TypeScript code:

```bash
git clone https://github.com/Deexv/sleekdo.git
cd sleekdo
npm install
npm run build
```

### 3. Link globally

Link Sleekdo to your global npm bin directory:

```bash
npm link
```

Verify that Sleekdo is globally available:

```bash
sleekdo --help
```

---

## How to use Sleekdo on a new project

### 1. Create a project directory

Navigate to any directory where you want to build software:

```bash
mkdir my-new-project
cd my-new-project
```

### 2. Launch with your chosen agent backend (recommended)

Launch the native interactive terminal UI (Section 97) with your installed agent:

```bash
# With Pi CLI backend
sleekdo --pi

# With Claude Code backend
sleekdo --claude

# With Google Antigravity backend
sleekdo --agy
```

### 3. Enter your objective

Type what you want to build when prompted:

```text
╭──────────────────────────────────────────────╮
│  SLEEKDO                                     │
│  Agent: Pi                                   │
│  Project: my-new-project                     │
╰──────────────────────────────────────────────╯

What do you want to build?

> Create a complete REST API with authentication, SQLite storage, tests, and rate limiting.
```

Sleekdo plans the work, validates the plan with A3 Reviewer, and displays the task roadmap.

### 4. Interactive session commands

Inside the interactive prompt (`sleekdo>`), run these commands:

- `run`. Starts the autonomous implementation and verification cycle.
- `status`. Prints active state, requirement coverage, and blocked tasks.
- `tasks`. Prints the current task breakdown with status symbols (`✓`, `→`, `○`, `✗`).
- `plan`. Prints the decomposed plan and criteria.
- `review <taskId>`. Shows the A3 review verdict and evidence for a specific task.
- `retry <taskId>`. Resets a task to `READY` to retry execution.
- `pause`. Pauses execution gracefully at task boundaries.
- `resume`. Resumes paused execution.
- `logs`. Displays recent audit events.
- `exit` or `quit`. Closes the interactive terminal.

### 5. Alternative: Batch mode workflow

For headless scripting, run standard subcommands directly:

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
