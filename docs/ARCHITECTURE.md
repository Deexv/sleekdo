# Sleekdo Architecture and Subsystems

Sleekdo sits above coding CLI agents. It controls the development lifecycle around the coding agent through strict role contracts, evidence collection, and state invariants.

## Key architectural decisions

### Batch-review model

Tasks are executed first, then reviewed in a single end-of-run batch. Each task receives a synthetic per-task review record, enabling traceability and the `review <taskId>` CLI command. This approach:

- Reduces review overhead by reviewing all tasks at once
- Provides per-task synthetic reviews for auditability
- Enables the `/lockin` command to skip A3 plan review for faster refinement
- Requires `AWAITING_REVIEW` as a satisfied dependency to prevent DependencyNotMetError

### Command cache

Tool-call results are memoized in the `CommandEngine`, preventing redundant `ls`, `find`, `read` calls. The cache:

- Keyed by `(command, args, cwd)` for precision
- Evicts oldest entries when exceeding 100 entries (LRU)
- Reduces execution time by avoiding repeated subprocess spawns
- Can be cleared with `clearCache()` when workspace changes

### Live agent streaming

Agent events (tool calls, message deltas, errors) stream in real-time to the CLI with:

- Tool calls rendered as dim lines with file targets
- A1 narration streamed with markdown formatting (bold, code, headings, bullets)
- Idle loader appears when the agent goes quiet (600ms)
- A2/A3 JSON suppressed to avoid noise
- Spinner row yields before content prints to prevent overlap

### Progress tracking

Executed-but-unreviewed tasks count toward progress, so the bar reflects real work. The formula:

```
progress = (approved + executed * 0.5) / total
```

This prevents the progress bar from staying at 0% during batch review.

### Design/anti-AI-slop review

A3 batch reviewer includes explicit checks for:

- Emoji-stuffed headers
- Lorem ipsum placeholder text
- Generic gradients and visual flourishes
- Repeated generic phrases

Tasks with slop are rejected and require remediation.

## The three logical AI roles

Sleekdo delegates tasks to three logical AI roles coordinated by an authoritative orchestrator:

- **A1 Worker.** Executes coding, test creation, and bug fixing work. Receives only authorized task definitions and local scope.
- **A2 Planner.** Understands the user objective, decomposes it into dependency-ordered tasks, discovers newly required work, and maintains the global roadmap.
- **A3 Reviewer.** Independently verifies completed work in fresh sessions using observable evidence from the workspace.

## Subsystems

### 1. Storage subsystem

- [`StateStore`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/state-store.ts). Manages atomic revisioned writes to `.sleekdo/state.json`. Creates immutable state snapshots in `.sleekdo/history/` on every revision.
- [`EventStore`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/event-store.ts). Appends structured audit events to `.sleekdo/events.jsonl` with timestamps, task identifiers, and actor roles.
- [`ArtifactStore`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/artifact-store.ts). Stores prompt dumps, diff snapshots, test outputs, and plans in `.sleekdo/artifacts/`.
- [`domain.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/types/domain.ts). Defines domain models, state schemas, task statuses, review decisions, and event contracts.

### 2. Core orchestration subsystem

- [`Orchestrator`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts). Central coordinator. Drives the primary execution loop, manages task queues, dispatches roles, handles mid-flight requirement updates, and enforces safety boundaries.
- [`StateMachine`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/state-machine.ts). Enforces valid lifecycle transitions (`PENDING -> READY -> IN_PROGRESS -> AWAITING_REVIEW -> APPROVED` or `REJECTED -> REMEDIATION_REQUIRED -> READY`). Rejects illegal state jumps.
- [`WorkspaceLock`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/workspace-lock.ts). Prevents race conditions and file mutations during review with PID-based lease locking.
- [`CrashRecoveryManager`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/crash-recovery.ts). Detects incomplete tasks and stale locks after crashes. Resets orphaned items to safe recovery states.
- [`RequirementMatrix`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/requirement-matrix.ts). Maintains bidirectional links between user requirements, discovered requirements, tasks, test assertions, and review evidence.
- [`InvestigationSystem`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/investigation-system.ts). Coordinates hypothesis testing and binary search diagnostics before fixing failed tasks.
- [`CleanupManager`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/cleanup-manager.ts). Coordinates dead entity analysis, validates confidence thresholds, and schedules cleanup tasks.
- [`FinalVerifier`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/final-verifier.ts). Evaluates 13 independent verification criteria before permitting transition to `PROJECT_COMPLETE`.
- [`ReviewContextBuilder`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/review-context-builder.ts). Assembles filtered, security conscious context bundles for A3 Reviewer.

### 3. Agent roles subsystem

- [`A1WorkerRole`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a1-worker.ts). Builds prompt contracts for A1 Worker, enforces task isolation, and protects internal `.sleekdo/` control files from agent modifications.
- [`A2PlannerRole`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a2-planner.ts). Decomposes objectives, discovers new tasks, validates dependency trees, and reassesses global progress.
- [`A3ReviewerRole`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts). Executes independent verification in clean sessions. Evaluates evidence, schema compliance, and acceptance criteria.

### 4. Agent adapter subsystem

- [`AgentAdapter`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/agent-adapter.ts). Defines the unified interface for CLI agent communication.
- [`PiAdapter`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/pi-adapter.ts). High-performance adapter for Pi CLI with streaming event capture.
- [`GenericPTYAdapter`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/generic-pty-adapter.ts). Universal process adapter supporting Claude Code, Agy, Python scripts, and custom CLIs.
- [`MockAdapter`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/mock-adapter.ts). Deterministic simulator for unit and integration testing.

### 5. Evidence collection subsystem

- [`SnapshotEngine`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/snapshot-engine.ts). Computes exact workspace diffs, created files, modified files, deleted files, and configuration shifts.
- [`FilesystemEngine`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/filesystem-engine.ts). Observes directory structures, file states, and hashes.
- [`GitEngine`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/git-engine.ts). Tracks uncommitted modifications, diff outputs, commit histories, and branch status.
- [`TestEngine`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/test-engine.ts). Executes project test suites, collects assertion outcomes, and detects test regressions.
- [`CommandEngine`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/command-engine.ts). Executes arbitrary diagnostic and verification commands with timeout controls.

### 6. Analysis subsystem

- [`DeadCodeAnalyzer`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/analysis/dead-code-analyzer.ts). Parses TypeScript ASTs to detect unused exports and functions. Classifies items into confirmed dead, probably dead, or dynamically referenced.
- [`DeadFileAnalyzer`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/analysis/dead-file-analyzer.ts). Scans project directories for unreferenced and orphaned files.
- [`DependencyAnalyzer`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/analysis/dependency-analyzer.ts). Audits `package.json` against actual import statements to locate unused or missing dependencies.

### 7. Command cache subsystem

- [`CommandEngine`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/command-engine.ts). Executes diagnostic commands with a built-in cache. Memoizes tool-call results keyed by `(command, args, cwd)`. Evicts oldest entries when cache exceeds 100 entries. Reduces redundant `ls`, `find`, `read` calls and improves performance.

### 7. Validation and configuration subsystem

- [`schemas.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/validation/schemas.ts). Enforces JSON schema contracts for plans, review verdicts, and investigations using Zod.
- [`config.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/config/config.ts). Validates and loads project configuration options and role overrides.
