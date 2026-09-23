# CLI Command Reference

This document provides complete syntax, parameters, and behavior for the `sleekdo` command-line interface.

## Commands

### sleekdo init

Initializes Sleekdo storage inside the target repository and records the primary user objective.

```bash
sleekdo init <objective>
```

- `<objective>`. Required string describing the project goal or software system to build.
- Behavior:
  - Creates `.sleekdo/` directory with `state.json`, `events.jsonl`, `history/`, `artifacts/`, and `plans/`.
  - Sets project status to `INIT`.
  - Extracts initial requirements and prepares the environment for planning.

### sleekdo run

Executes the autonomous development lifecycle until project completion or a blocking event.

```bash
sleekdo run [--workspace <path>] [--adapter <type>] [--command <cmd>] [--model <model>] [--provider <provider>]
```

- Options:
  - `-w, --workspace <path>`. Target workspace directory. Defaults to the current directory.
  - `-a, --adapter <type>`. Adapter type (`pi`, `pty`, or `mock`).
  - `-c, --command <cmd>`. CLI agent executable command.
  - `-m, --model <model>`. Model identifier passed to the agent.
  - `-p, --provider <provider>`. Provider identifier passed to the agent.
- Behavior:
  - Invokes A2 Planner to produce or reassess the project plan.
  - Submits plan to A3 Reviewer for validation before implementation.
  - Dispatches authorized tasks to A1 Worker in dependency order.
  - Captures workspace diffs and test results.
  - Freezes workspace and invokes A3 Reviewer for independent review.
  - Runs investigation workflows on repeated task failures.
  - Performs recurring dead-code and dead-file sweeps.
  - Executes 13 criteria final verification before declaring `PROJECT_COMPLETE`.

### sleekdo status

Displays live project status, requirement matrix, tasks, and locks.

```bash
sleekdo status
```

- Output details:
  - Global project status (`INIT`, `PLANNING`, `EXECUTING`, `PAUSED`, `AWAITING_CLARIFICATION`, `COMPLETED`).
  - Task progress counts (`COMPLETED`, `IN_PROGRESS`, `PENDING`, `REJECTED`, `BLOCKED`).
  - Blocked work items with their blocking reasons.
  - Requirement coverage statistics (`VERIFIED`, `COVERED`, `PARTIALLY_COVERED`, `UNCOVERED`).
  - Active workspace lease information and lock holder PID.

### sleekdo verify

Runs system verification across tests, git state, dead entities, and requirements without executing worker tasks.

```bash
sleekdo verify
```

- Behavior:
  - Executes full test suite.
  - Runs dead-code, dead-file, and dependency hygiene analysis.
  - Verifies workspace git status cleanliness.
  - Checks requirement matrix coverage.
  - Prints pass or fail status for each verification gate.

### sleekdo clean

Performs static analysis to detect unreferenced code, abandoned files, and unused dependencies.

```bash
sleekdo clean
```

- Behavior:
  - Analyzes TypeScript ASTs for unused functions, exports, and classes.
  - Scans workspace for orphaned files not imported or referenced.
  - Audits `package.json` against actual import statements.
  - Classifies findings into `CONFIRMED_DEAD`, `PROBABLY_DEAD`, and `DYNAMICALLY_REFERENCED`.
  - Schedules verified cleanup tasks for confirmed dead items.

### sleekdo replan

Forces A2 Planner to perform a full project reassessment and synchronize with requirement changes.

```bash
sleekdo replan
```

- Behavior:
  - Gathers current repository evidence, completed tasks, and requirement matrix.
  - Prompts A2 Planner to adjust task roadmaps, obsolete invalid tasks, and add new tasks.
  - Archives previous plan in `.sleekdo/plans/` and increments plan version.
  - Requires A3 Reviewer plan approval before execution continues.

### sleekdo pause

Gracefully pauses the orchestrator run after current task boundaries.

```bash
sleekdo pause
```

- Behavior:
  - Sets project status to `PAUSED`.
  - Allows current in-progress atomic operation to complete.
  - Preserves exact task states and release locks.

### sleekdo resume

Resumes execution from persisted state after a pause or crash.

```bash
sleekdo resume
```

- Behavior:
  - Runs crash recovery to reconcile interrupted tasks and stale locks.
  - Restores active plan and continues primary execution loop.

### sleekdo override

Allows a human operator to override review decisions with mandatory audit logging.

```bash
sleekdo override <taskId> <approve|reject> [reason]
```

- Arguments:
  - `<taskId>`. Target task identifier.
  - `<approve|reject>`. Desired verdict override.
  - `[reason]`. Justification string recorded in the audit event log.

### sleekdo clarify

Submits an answer to a question raised by A2 Planner or A3 Reviewer.

```bash
sleekdo clarify <questionId> <answer>
```

- Arguments:
  - `<questionId>`. Target question identifier.
  - `<answer>`. Text answer provided by the user.

### sleekdo inspect

Displays detailed diagnostic information for a specific task.

```bash
sleekdo inspect <taskId>
```

- Output includes:
  - Task definition, criteria, and dependencies.
  - Input prompt sent to A1 Worker.
  - Before/after workspace diff and touched files.
  - Execution logs and tool output streams.
  - Review verdict, findings, and remediation requirements.
  - Active or historical investigation records.
