# Sleekdo

Sleekdo is an agent orchestration and verification system that enables coding CLI agents to autonomously build, modify, debug, test, refactor, and complete projects of arbitrary size and type.

## Architectural Roles

The system is organized around three logical AI roles coordinated by an authoritative orchestrator:

- **A1 — Worker**: Executes coding, debugging, and implementation work using CLI tools.
- **A2 — Planner**: Decomposes user objectives, maintains the global roadmap, continuously reassesses project state, and discovers newly required work.
- **A3 — Reviewer**: Independently verifies completed work in fresh sessions using observable evidence (filesystem diffs, git changes, test assertions, runtime state).

## Key Components

1. **Authoritative Orchestrator**: Controls all task transitions; no agent can approve its own work or skip steps.
2. **Task State Machine**: Enforces strict invariants (`PENDING -> READY -> IN_PROGRESS -> AWAITING_REVIEW -> APPROVED` or `REJECTED -> REMEDIATION_REQUIRED -> READY`).
3. **Agent Adapters**: Pluggable adapter layer supporting Pi CLI (`PiAdapter`), generic PTY agents (`GenericPTYAdapter`), and test simulators (`MockAdapter`).
4. **Workspace Isolation & Locking**: PID-based lease locking freezes the workspace during A3 review to prevent mutation races.
5. **Crash Recovery & Reconciliation**: Restores interrupted tasks to safe states on restart and cleans stale locks.
6. **Requirement Traceability**: Requirement coverage matrix links user requirements and discovered requirements to tasks, tests, and evidence.
7. **Evidence-Driven Debugging**: Binary-search hypothesis elimination confirms causal failure mechanisms before applying minimal-scope fixes.
8. **Dead-Code & Dead-File Analysis**: Recurring sweeps classify unused code (`CONFIRMED_DEAD`, `PROBABLY_DEAD`, `DYNAMICALLY_REFERENCED`, `REQUIRED`) and generate verified cleanup tasks.
9. **Final Verification Fixed-Point**: 13 global criteria must be proven with direct evidence before declaring `PROJECT_COMPLETE`.

## CLI Usage

```bash
# Initialize project with user request
sleekdo init "Build a REST API for user authentication"

# Run orchestrator loop to completion
sleekdo run

# View project status, requirements, and tasks
sleekdo status

# Run system verification
sleekdo verify

# Run dead-code and dead-file analysis
sleekdo clean

# Inspect a specific task
sleekdo inspect task_001
```

## Running Tests

```bash
# Run unit and integration tests
npm test

# Run end-to-end suite against live Pi CLI
npm run test:e2e

# Run all test suites
npm run test:all
```
