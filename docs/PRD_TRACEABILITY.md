# PRD Section Traceability Reference

This document maps all 96 sections of the Product Requirements Document to their implementation in the codebase.

## Part 1: Product definition and core roles (Sections 1 to 7)

### Section 1. Product definition
- **Requirement.** Define Sleekdo as an agent orchestration and verification system sitting above coding CLI agents. Support arbitrary software project categories.
- **Implementation.** [`domain.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/types/domain.ts), [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts).
- **Invariants.** Sleekdo does not replace the coding agent. It controls development around the agent.
- **Verification.** Verified in unit tests and live Pi CLI runs.

### Section 2. Primary objective
- **Requirement.** Progress autonomously from user request through understanding, planning, execution, verification, reassessment, and final evidence-based completion.
- **Implementation.** [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L48-L150).
- **Invariants.** Completion requires independent verification. Empty task list does not equal completion.
- **Verification.** End-to-end tests assert the full lifecycle across multi-stage objectives.

### Section 3. Core roles
- **Requirement.** Establish three distinct AI roles: A1 Worker, A2 Planner, and A3 Reviewer.
- **Implementation.** [`a1-worker.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a1-worker.ts), [`a2-planner.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a2-planner.ts), [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts).
- **Invariants.** Roles never merge into one prompt. Each role runs in an isolated context.
- **Verification.** Role prompt tests verify structural role separation.

### Section 4. A2 Planner
- **Requirement.** Responsible for high-level decomposition, roadmap maintenance, and continuous reassessment after completed work.
- **Implementation.** [`a2-planner.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a2-planner.ts#L20-L120).
- **Invariants.** Must produce dependency-ordered tasks with explicit acceptance criteria.
- **Verification.** Plan schema tests ensure valid task hierarchy and criteria generation.

### Section 5. A3 Reviewer
- **Requirement.** Independent verification agent. Operates in a fresh session for each review with direct workspace evidence.
- **Implementation.** [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts#L25-L95).
- **Invariants.** Must receive fresh session context. Never shares conversational memory with A1.
- **Verification.** Review context tests assert session freshness.

### Section 6. Orchestrator
- **Requirement.** Sole authority for task state transitions and agent dispatch.
- **Implementation.** [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L30-L100).
- **Invariants.** Neither A1, A2, nor A3 can modify task states directly.
- **Verification.** State machine integration tests confirm transition authority.

### Section 7. Fundamental state invariant
- **Requirement.** No work item can be considered complete or allow dependent work to proceed until verified by A3.
- **Implementation.** [`state-machine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/state-machine.ts#L15-L80).
- **Invariants.** `APPROVED` state is reachable only via valid A3 review verdict.
- **Verification.** Illegal state transition tests prove unreviewed tasks cannot reach `APPROVED`.

---

## Part 2: Planning and task lifecycle (Sections 8 to 13)

### Section 8. Recursive project planning
- **Requirement.** Do not treat initial plan as fixed. Continuously discover new required work as implementation unfolds.
- **Implementation.** [`a2-planner.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a2-planner.ts), [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L220-L260).
- **Invariants.** Discovered tasks link back to source tasks or discovery triggers.
- **Verification.** Tested in live scenario with recursive task discovery.

### Section 9. Recursive planning loop
- **Requirement.** After task completion, invoke A2 with completed evidence, git diffs, and remaining roadmap to reassess remaining work.
- **Implementation.** [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L240-L290).
- **Invariants.** Reassessment must run before dispatching the next task batch.
- **Verification.** Orchestrator loop tests verify reassessment invocation.

### Section 10. Plan approval
- **Requirement.** Initial plan produced by A2 must be validated and approved by A3 before execution begins.
- **Implementation.** [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L105-L140).
- **Invariants.** Execution cannot start without an approved plan.
- **Verification.** Plan verification tests confirm A3 validates plan structure and coverage.

### Section 11. Task definition
- **Requirement.** Every task has stable identity, title, description, dependencies, acceptance criteria, and requirement links.
- **Implementation.** [`domain.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/types/domain.ts#L18-L45), [`schemas.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/validation/schemas.ts).
- **Invariants.** Task identifiers remain immutable throughout the project lifecycle.
- **Verification.** Schema validation tests assert task structure integrity.

### Section 12. A1 task isolation
- **Requirement.** A1 receives only the authorized task scope and relevant local context.
- **Implementation.** [`a1-worker.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a1-worker.ts#L30-L75).
- **Invariants.** A1 does not receive unassigned backlog tasks or control instructions.
- **Verification.** Worker prompt generation tests verify scoped inputs.

### Section 13. A1 completion detection
- **Requirement.** Agent adapter detects turn completion. A1 does not manually signal completion through task state edits.
- **Implementation.** [`agent-adapter.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/agent-adapter.ts), [`pi-adapter.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/pi-adapter.ts).
- **Invariants.** Completion is detected via process termination, event streams, or idle timeouts.
- **Verification.** Adapter tests assert proper turn completion detection.

---

## Part 3: Adapters and evidence collection (Sections 14 to 19)

### Section 14. Agent adapter architecture
- **Requirement.** Pluggable interface supporting arbitrary coding agents.
- **Implementation.** [`agent-adapter.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/agent-adapter.ts), [`generic-pty-adapter.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/generic-pty-adapter.ts), [`pi-adapter.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/pi-adapter.ts).
- **Invariants.** Orchestrator interacts with agents exclusively through adapter interface.
- **Verification.** Multi-adapter test suite passes against mock, PTY, and Pi adapters.

### Section 15. Evidence collection
- **Requirement.** Collect multi-faceted evidence: git status, file diffs, test outputs, and command exit codes.
- **Implementation.** [`snapshot-engine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/snapshot-engine.ts), [`git-engine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/git-engine.ts), [`test-engine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/test-engine.ts).
- **Invariants.** Verification decisions require direct workspace evidence.
- **Verification.** Evidence engine tests verify diff, git, and test result extraction.

### Section 16. Before and after workspace snapshots
- **Requirement.** Record workspace snapshot before task execution and compare after execution to compute exact delta.
- **Implementation.** [`snapshot-engine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/snapshot-engine.ts#L40-L110).
- **Invariants.** Diff tracks created files, modified files, deleted files, dependency shifts, and configuration changes.
- **Verification.** Snapshot engine tests verify diff generation accuracy.

### Section 17. Sleekdo data architecture
- **Requirement.** Store all system data under `.sleekdo/` with structured state, event logs, and artifacts.
- **Implementation.** [`state-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/state-store.ts), [`event-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/event-store.ts), [`artifact-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/artifact-store.ts).
- **Invariants.** Control data resides cleanly separated from project source files.
- **Verification.** Directory initialization tests confirm `.sleekdo/` layout.

### Section 18. Sleekdo state
- **Requirement.** Persistent JSON state capturing roadmap, requirements, leases, and run metadata.
- **Implementation.** [`state-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/state-store.ts#L25-L80).
- **Invariants.** Atomic writes prevent file corruption during unexpected termination.
- **Verification.** Atomic write and revisioning tests assert consistency.

### Section 19. Event log
- **Requirement.** Append-only event stream recording all lifecycle actions, transitions, and errors.
- **Implementation.** [`event-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/event-store.ts#L15-L55).
- **Invariants.** Events are immutable and formatted as JSON Lines.
- **Verification.** Event store tests verify sequential event persistence.

---

## Part 4: Review and rejection mechanics (Sections 20 to 25)

### Section 20. A3 review context
- **Requirement.** Supply A3 with task description, acceptance criteria, before/after diffs, test outputs, and relevant source snippets.
- **Implementation.** [`review-context-builder.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/review-context-builder.ts).
- **Invariants.** Exclude A1 conversation history to prevent hallucination transfer.
- **Verification.** Context builder tests assert absence of A1 conversational artifacts.

### Section 21. A3 fresh session requirement
- **Requirement.** A3 must evaluate each review in a completely fresh session.
- **Implementation.** [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts#L30-L50).
- **Invariants.** No state carries over between review turns.
- **Verification.** Session lifecycle tests verify clean instantiation per review.

### Section 22. A3 review policy
- **Requirement.** Evaluate whether task criteria are met, whether regressions occurred, and whether code conforms to repository standards.
- **Implementation.** [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts#L55-L110).
- **Invariants.** Rejection occurs if any acceptance criterion lacks evidence.
- **Verification.** Policy evaluation tests confirm rejection triggers on missing criteria.

### Section 23. A3 decisions
- **Requirement.** Output structured verdict: `APPROVE`, `REJECT`, or `NEEDS_INVESTIGATION`.
- **Implementation.** [`domain.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/types/domain.ts#L60-L75), [`schemas.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/validation/schemas.ts).
- **Invariants.** Verdict must validate against Zod review schema.
- **Verification.** Review schema tests assert valid decision parsing.

### Section 24. Rejection requirements
- **Requirement.** Every rejection must specify exact failure reasons, failing evidence, and required remediation steps.
- **Implementation.** [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts#L80-L105), [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L310-L345).
- **Invariants.** Vague or unsubstantiated rejections are rejected by schema validation.
- **Verification.** Rejection handling tests assert inclusion of remediation instructions.

### Section 25. Preventing endless review loops
- **Requirement.** Track retry counts per task. If task exceeds maximum attempts, escalate to investigation or human intervention.
- **Implementation.** [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L320-L335).
- **Invariants.** Loop terminates deterministically before unbounded retries occur.
- **Verification.** Maximum retry threshold tests verify transition to blocked state.

---

## Part 5: Evidence-driven debugging (Sections 26 to 33)

### Section 26. Evidence-driven debugging system
- **Requirement.** Require structured diagnostics for complex or recurring failures instead of guess-driven patching.
- **Implementation.** [`investigation-system.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/investigation-system.ts#L20-L80).
- **Invariants.** Debugging requires active hypotheses and empirical test steps.
- **Verification.** Investigation system tests verify hypothesis registration.

### Section 27. Binary-search debugging
- **Requirement.** Narrow down failure surfaces through binary partitioning of execution paths, inputs, or configurations.
- **Implementation.** [`investigation-system.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/investigation-system.ts#L85-L140).
- **Invariants.** Each iteration eliminates at least one candidate cause.
- **Verification.** Diagnostic isolation tests verify elimination logic.

### Section 28. Maximum-information diagnostics
- **Requirement.** Design diagnostic probes that maximize information gain per run.
- **Implementation.** [`investigation-system.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/investigation-system.ts#L100-L150).
- **Invariants.** Probes target the branch point between working and failing behavior.
- **Verification.** Probe generation tests verify focused diagnostic construction.

### Section 29. Runtime evidence
- **Requirement.** Collect live command outputs, error stacks, and system exit codes to evaluate hypotheses.
- **Implementation.** [`command-engine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/command-engine.ts), [`test-engine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/test-engine.ts).
- **Invariants.** No hypothesis is confirmed without runtime evidence.
- **Verification.** Runtime command execution tests verify output capture.

### Section 30. No guess-driven debugging
- **Requirement.** Forbid applying code modifications without an active confirmed failure mechanism.
- **Implementation.** [`investigation-system.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/investigation-system.ts#L155-L180).
- **Invariants.** Proposed fixes must address the verified root cause.
- **Verification.** Debugging workflow tests assert mechanism verification before fix dispatch.

### Section 31. Mechanism confirmation before fix
- **Requirement.** Validate root cause by reproducing the failure and confirming the minimal reproducing condition.
- **Implementation.** [`investigation-system.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/investigation-system.ts#L185-L210).
- **Invariants.** A fix task is created only after root cause confirmation.
- **Verification.** Root cause confirmation tests assert prerequisite checks.

### Section 32. Debugging state
- **Requirement.** Store investigation state, candidate hypotheses, experiment logs, and elimination records in state store.
- **Implementation.** [`domain.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/types/domain.ts#L80-L105), [`investigation-system.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/investigation-system.ts).
- **Invariants.** Investigation records persist across system crashes and restarts.
- **Verification.** Investigation persistence tests confirm serialization to disk.

### Section 33. Fix isolation
- **Requirement.** Restrict bug fixes to the minimal code change necessary to address the root cause without unrequested refactoring.
- **Implementation.** [`a1-worker.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a1-worker.ts#L80-L110).
- **Invariants.** Fix tasks include strict scope boundaries.
- **Verification.** Fix scope tests verify diff size and impact boundary checks.

---

## Part 6: Dead code, dead files, and cleanup (Sections 34 to 40)

### Section 34. Recurring dead-code analysis
- **Requirement.** Analyze codebase periodically to identify unreferenced functions, classes, and variables introduced during development.
- **Implementation.** [`dead-code-analyzer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/analysis/dead-code-analyzer.ts).
- **Invariants.** Sweeps run at configured task intervals and during final verification.
- **Verification.** AST dead code scanner tests identify unused symbols.

### Section 35. Dead-code verification triggers
- **Requirement.** Trigger analysis after major milestones, refactoring tasks, or batch task completions.
- **Implementation.** [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L360-L385).
- **Invariants.** Trigger schedule is tracked in project state.
- **Verification.** Orchestrator milestone tests confirm trigger invocation.

### Section 36. Dead-code analysis
- **Requirement.** Classify discovered candidates: `CONFIRMED_DEAD`, `PROBABLY_DEAD`, `DYNAMICALLY_REFERENCED`, or `REQUIRED`.
- **Implementation.** [`dead-code-analyzer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/analysis/dead-code-analyzer.ts#L45-L120).
- **Invariants.** Only items with confidence above threshold are scheduled for deletion.
- **Verification.** Classification tests verify proper categorization of test symbols.

### Section 37. Dead-code must not be removed blindly
- **Requirement.** Verify candidates through test suite execution and import tracing before generating cleanup tasks.
- **Implementation.** [`cleanup-manager.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/cleanup-manager.ts#L30-L75).
- **Invariants.** Items marked `DYNAMICALLY_REFERENCED` or required by tests are preserved.
- **Verification.** Safety guard tests verify dynamic references are not deleted.

### Section 38. Dead-file analysis
- **Requirement.** Detect orphaned files, unused scripts, and abandoned test fixtures across the workspace.
- **Implementation.** [`dead-file-analyzer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/analysis/dead-file-analyzer.ts).
- **Invariants.** Scans repository root excluding `.sleekdo/` and build directories.
- **Verification.** Orphaned file scanner tests identify untracked orphaned files.

### Section 39. Cleanup tasks
- **Requirement.** Schedule verified cleanup tasks through the normal A1 and A3 lifecycle.
- **Implementation.** [`cleanup-manager.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/cleanup-manager.ts#L80-L125).
- **Invariants.** Cleanup tasks undergo independent review like standard feature tasks.
- **Verification.** Cleanup task generation tests assert proper task provisioning.

### Section 40. Final dead-code sweep
- **Requirement.** Execute comprehensive dead entity sweep as a mandatory prerequisite for project completion.
- **Implementation.** [`final-verifier.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/final-verifier.ts#L90-L115).
- **Invariants.** Zero unverified dead code candidates remain at completion.
- **Verification.** Final verification tests assert sweep execution before completion.

---

## Part 7: Reassessment and completion criteria (Sections 41 to 46)

### Section 41. Global reassessment
- **Requirement.** Periodically evaluate entire project trajectory against primary objectives and requirement matrix.
- **Implementation.** [`a2-planner.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a2-planner.ts#L130-L175).
- **Invariants.** Reassessment can add, adjust, or obsolete backlog items.
- **Verification.** Reassessment tests verify roadmap adjustments.

### Section 42. Newly discovered requirements
- **Requirement.** Register requirements discovered during implementation, map them to parent objectives, and allocate tasks.
- **Implementation.** [`requirement-matrix.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/requirement-matrix.ts#L40-L75).
- **Invariants.** Discovered requirements have tracked origins and validation criteria.
- **Verification.** Requirement tracking tests confirm parent-child linkages.

### Section 43. No premature completion
- **Requirement.** Prevent declaring completion while open tasks, unverified requirements, or failing tests exist.
- **Implementation.** [`final-verifier.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/final-verifier.ts#L40-L70).
- **Invariants.** Project status cannot transition to `COMPLETED` if any check fails.
- **Verification.** Guard tests confirm rejection of premature completion attempts.

### Section 44. Final completion verification
- **Requirement.** Execute 13 global verification checks across build, test, git status, requirements, and evidence.
- **Implementation.** [`final-verifier.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/final-verifier.ts#L75-L160).
- **Invariants.** All 13 checks must pass concurrently with direct evidence.
- **Verification.** Full verification suite passes all 13 checks on verified projects.

### Section 45. Completion must be evidence-based
- **Requirement.** Final completion verdict records the exact commands run, outputs observed, and git status hashes.
- **Implementation.** [`final-verifier.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/final-verifier.ts#L165-L210).
- **Invariants.** Evidence artifact is written to `.sleekdo/artifacts/final_verification.json`.
- **Verification.** Output inspection tests confirm generated verification records.

### Section 46. User clarification
- **Requirement.** Allow agents to pause execution and request human guidance when encountering irreconcilable ambiguity.
- **Implementation.** [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L390-L415), [`cli.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/cli/cli.ts#L180-L200).
- **Invariants.** System transitions to `AWAITING_CLARIFICATION` and resumes upon answer submission.
- **Verification.** Clarification tests verify workflow pause and resume.

---

## Part 8: Workspace protection and safety (Sections 47 to 54)

### Section 47. Permission and safety boundaries
- **Requirement.** Restrict agent actions to workspace directory. Enforce command execution timeout limits.
- **Implementation.** [`config.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/config/config.ts), [`command-engine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/command-engine.ts#L25-L60).
- **Invariants.** Commands running past timeout limits are killed.
- **Verification.** Command engine timeout tests assert child process termination.

### Section 48. Workspace isolation
- **Requirement.** Prevent A1 Worker from modifying internal `.sleekdo/` state, configuration, and audit records.
- **Implementation.** [`a1-worker.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a1-worker.ts#L45-L65), [`snapshot-engine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/snapshot-engine.ts).
- **Invariants.** Diff engine rejects mutations inside `.sleekdo/` directory.
- **Verification.** Security tests assert rejection of unauthorized `.sleekdo` file modifications.

### Section 49. Review-time workspace freeze
- **Requirement.** Freeze workspace during A3 review using lease locking to prevent mutation races.
- **Implementation.** [`workspace-lock.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/workspace-lock.ts#L20-L75).
- **Invariants.** Lock records holder PID, task identifier, and expiration timestamp.
- **Verification.** Lock tests confirm mutual exclusion and lease renewal.

### Section 50. Review identity
- **Requirement.** Track unique review attempt identifiers, timestamps, reviewer role, and target task.
- **Implementation.** [`domain.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/types/domain.ts#L65-L80), [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts).
- **Invariants.** Review records are stored with immutable review IDs.
- **Verification.** Review record tests assert unique ID generation.

### Section 51. State revisioning
- **Requirement.** Maintain monotonically increasing state revision numbers and historical backups.
- **Implementation.** [`state-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/state-store.ts#L35-L65).
- **Invariants.** Each write increments revision counter and archives previous state.
- **Verification.** State store tests verify revision monotonicity and archive creation.

### Section 52. Crash recovery
- **Requirement.** Automatically reconcile state upon startup following an unexpected crash or process kill.
- **Implementation.** [`crash-recovery.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/crash-recovery.ts#L20-L90).
- **Invariants.** In-progress tasks are reset to `READY`, review-in-progress tasks to `AWAITING_REVIEW`, and stale locks are released.
- **Verification.** Crash recovery tests verify state cleanup after simulated sudden termination.

### Section 53. Idempotency
- **Requirement.** Ensure repeated execution of recovery, state loading, and planning actions yields identical safe state.
- **Implementation.** [`crash-recovery.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/crash-recovery.ts), [`state-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/state-store.ts).
- **Invariants.** Re-running recovery on recovered state causes no state divergence.
- **Verification.** Idempotency tests verify repeated recovery stability.

### Section 54. Parallelism
- **Requirement.** Support parallel execution of non-conflicting tasks with independent workspace boundaries.
- **Implementation.** [`state-machine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/state-machine.ts), [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts).
- **Invariants.** Concurrent tasks must have non-overlapping dependency sets.
- **Verification.** Dependency graph tests confirm concurrent task scheduling legality.

---

## Part 9: Quality and testing strategy (Sections 55 to 61)

### Section 55. Git integration
- **Requirement.** Query git status, capture diffs, inspect commit history, and verify branch cleanliness.
- **Implementation.** [`git-engine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/git-engine.ts).
- **Invariants.** Git operations operate non-destructively during evidence collection.
- **Verification.** Git engine tests verify diff output and commit inspection.

### Section 56. Testing strategy
- **Requirement.** Execute project tests automatically, capture test outputs, and record pass or fail metrics.
- **Implementation.** [`test-engine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/test-engine.ts).
- **Invariants.** Tests run via configured test runners with explicit timeout budgets.
- **Verification.** Test engine tests verify test execution and metric parsing.

### Section 57. Test gap detection
- **Requirement.** Identify implemented features or modified code paths lacking corresponding automated tests.
- **Implementation.** [`final-verifier.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/final-verifier.ts#L120-L145).
- **Invariants.** Modules modified during tasks must have associated test coverage.
- **Verification.** Test gap detection tests verify warning or block on untested code.

### Section 58. Regression protection
- **Requirement.** Ensure existing passing tests continue to pass after new task execution.
- **Implementation.** [`test-engine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/test-engine.ts#L60-L95), [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts).
- **Invariants.** Introduction of test failures triggers automatic task rejection.
- **Verification.** Regression tests confirm task rejection when previously passing tests fail.

### Section 59. Refactoring
- **Requirement.** Support dedicated refactoring tasks that improve internal code structure without changing observable behavior.
- **Implementation.** [`a1-worker.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a1-worker.ts), [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts).
- **Invariants.** Refactoring reviews require passing regression suites and zero behavior shifts.
- **Verification.** Refactor task verification tests assert behavior preservation.

### Section 60. Scope control
- **Requirement.** Detect out-of-scope modifications by comparing task acceptance criteria with touched file sets.
- **Implementation.** [`snapshot-engine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/evidence/snapshot-engine.ts), [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts).
- **Invariants.** Modifications to unrelated subsystems trigger review warnings or rejection.
- **Verification.** Scope boundary tests assert detection of unintended file edits.

### Section 61. Temporary artifacts
- **Requirement.** Isolate scratch scripts, temporary fixtures, and debug logs. Ensure cleanup before final verification.
- **Implementation.** [`artifact-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/artifact-store.ts), [`cleanup-manager.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/cleanup-manager.ts).
- **Invariants.** Temporary artifacts do not pollute version control root.
- **Verification.** Artifact lifecycle tests verify storage under `.sleekdo/` and final cleanup.

---

## Part 10: Role prompt contracts and rules (Sections 62 to 68)

### Section 62. A2 planning rules
- **Requirement.** Enforce rules for planning: atomicity, clear dependencies, test obligations, and explicit criteria.
- **Implementation.** [`a2-planner.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a2-planner.ts#L35-L80).
- **Invariants.** Plans with circular dependencies or missing criteria fail schema validation.
- **Verification.** Plan validation tests assert compliance with planning rules.

### Section 63. A3 review rules
- **Requirement.** Enforce rules for review: skepticism, evidence demand, test verification, and regression inspection.
- **Implementation.** [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts#L40-L90).
- **Invariants.** Approval without verifying test results is prohibited.
- **Verification.** Review contract tests verify enforcement of review skepticism.

### Section 64. A1 execution rules
- **Requirement.** Enforce rules for workers: execute only assigned task, do not alter configuration without authorization, and write tests for new code.
- **Implementation.** [`a1-worker.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a1-worker.ts#L35-L70).
- **Invariants.** Worker prompts include explicit behavioral constraints.
- **Verification.** Worker prompt inspection tests verify constraint presence.

### Section 65. Agent prompt separation
- **Requirement.** Maintain distinct, isolated prompt templates for each role.
- **Implementation.** [`a1-worker.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a1-worker.ts), [`a2-planner.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a2-planner.ts), [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts).
- **Invariants.** Prompts for one role never include internal instructions for another role.
- **Verification.** Prompt contract tests verify prompt segregation.

### Section 66. A1 prompt contract
- **Requirement.** Provide task description, acceptance criteria, relevant context, and output format to A1.
- **Implementation.** [`a1-worker.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a1-worker.ts#L25-L65).
- **Invariants.** Output contains structured turn summary.
- **Verification.** A1 contract tests verify prompt structure.

### Section 67. A2 prompt contract
- **Requirement.** Provide user objective, current roadmap, completed evidence, and schema specification to A2.
- **Implementation.** [`a2-planner.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a2-planner.ts#L45-L95).
- **Invariants.** A2 output must match Zod planning schema.
- **Verification.** A2 output parser tests assert valid schema output extraction.

### Section 68. A3 prompt contract
- **Requirement.** Provide task contract, diff summary, test logs, command outputs, and review schema to A3.
- **Implementation.** [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts#L50-L100).
- **Invariants.** A3 output must match Zod review schema.
- **Verification.** A3 output parser tests assert valid schema output extraction.

---

## Part 11: Traceability and fixed-point completion (Sections 69 to 74)

### Section 69. Global project state
- **Requirement.** Unified data structure containing roadmap, requirement matrix, leases, investigations, and metadata.
- **Implementation.** [`domain.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/types/domain.ts#L110-L160), [`state-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/state-store.ts).
- **Invariants.** Global state conforms to `GlobalProjectState` schema.
- **Verification.** State serialization tests verify complete round-trip fidelity.

### Section 70. Requirement traceability
- **Requirement.** Link every user requirement to decomposing tasks, implementing commits, and validating tests.
- **Implementation.** [`requirement-matrix.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/requirement-matrix.ts#L25-L60).
- **Invariants.** No requirement exists without traceable associations.
- **Verification.** Traceability tests verify bidirectional query capabilities.

### Section 71. Requirement coverage
- **Requirement.** Track fulfillment status (`UNCOVERED`, `PARTIALLY_COVERED`, `COVERED`, `VERIFIED`) for all requirements.
- **Implementation.** [`requirement-matrix.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/requirement-matrix.ts#L65-L105).
- **Invariants.** Requirement reaches `VERIFIED` only after all linked tasks are `APPROVED` and tests pass.
- **Verification.** Coverage calculation tests verify status transition calculations.

### Section 72. Discovery traceability
- **Requirement.** Track newly discovered requirements back to their discovery context and task origins.
- **Implementation.** [`requirement-matrix.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/requirement-matrix.ts#L45-L75).
- **Invariants.** Discovered requirements record originating task ID and discovery rationale.
- **Verification.** Origin tracing tests verify discovery metadata persistence.

### Section 73. Completion as a fixed-point process
- **Requirement.** Re-evaluate reassessment and verification until a stable fixed point is reached where no new tasks or gaps emerge.
- **Implementation.** [`final-verifier.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/final-verifier.ts#L30-L70), [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L270-L310).
- **Invariants.** Completion requires convergence across two consecutive fixed-point checks.
- **Verification.** Fixed-point convergence tests verify stability detection.

### Section 74. Final verification must be fresh
- **Requirement.** Run final verification in an independent, clean session using fresh command runs rather than cached results.
- **Implementation.** [`final-verifier.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/final-verifier.ts#L75-L115).
- **Invariants.** Test suites and build checks execute afresh during final verification.
- **Verification.** Fresh verification tests confirm live command re-execution.

---

## Part 12: Observability and operational control (Sections 75 to 80)

### Section 75. Observability
- **Requirement.** Provide real-time logging, formatted status reporting, and event telemetry.
- **Implementation.** [`event-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/event-store.ts), [`cli.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/cli/cli.ts#L80-L150).
- **Invariants.** All state transitions produce structured events.
- **Verification.** CLI status tests assert clear presentation of project metrics.

### Section 76. Progress must not be measured only by task count
- **Requirement.** Measure progress through requirement coverage, test passage, and verified functionality rather than completed task counts alone.
- **Implementation.** [`requirement-matrix.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/requirement-matrix.ts), [`cli.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/cli/cli.ts#L100-L140).
- **Invariants.** Status displays report requirement percentage alongside task counts.
- **Verification.** Status output tests verify multi-metric reporting.

### Section 77. Human override
- **Requirement.** Allow human operators to approve, reject, or reprioritize tasks with mandatory audit event logging.
- **Implementation.** [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L420-L450), [`cli.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/cli/cli.ts#L205-L230).
- **Invariants.** Human overrides log operator identity and justification.
- **Verification.** Override command tests verify state transition and audit event generation.

### Section 78. Requirement changes
- **Requirement.** Handle mid-flight requirement additions or alterations without corrupting existing completed work.
- **Implementation.** [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L455-L510).
- **Invariants.** Requirement changes trigger impact analysis, task obsolescence, and plan version bump.
- **Verification.** Requirement change integration tests verify plan updates and task provisioning.

### Section 79. Plan versioning
- **Requirement.** Archive historical plans under `.sleekdo/plans/` and track version numbers in global state.
- **Implementation.** [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L485-L505), [`state-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/state-store.ts).
- **Invariants.** Plan version increments upon every reassessment or requirement shift.
- **Verification.** Plan archive tests assert sequential plan file creation.

### Section 80. Architecture consistency
- **Requirement.** Ensure new tasks and modifications conform to established architectural conventions.
- **Implementation.** [`a2-planner.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a2-planner.ts), [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts).
- **Invariants.** Tasks violating project patterns are flagged during planning or review.
- **Verification.** Review rules tests assert architectural boundary verification.

---

## Part 13: Hygiene, security, and independence (Sections 81 to 86)

### Section 81. Dependency hygiene
- **Requirement.** Audit dependencies for unused packages, missing declarations, and unnecessary duplicate packages.
- **Implementation.** [`dependency-analyzer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/analysis/dependency-analyzer.ts).
- **Invariants.** Scans `package.json` against project imports during cleanup sweeps.
- **Verification.** Dependency analyzer tests detect unused packages and missing imports.

### Section 82. Documentation and project knowledge
- **Requirement.** Maintain project documentation, architecture notes, and task execution records.
- **Implementation.** [`artifact-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/artifact-store.ts).
- **Invariants.** Generated architecture documentation is stored in `.sleekdo/artifacts/`.
- **Verification.** Documentation tests verify persistence of generated project artifacts.

### Section 83. Artifact and context management
- **Requirement.** Structure storage of execution artifacts, diff outputs, test logs, and intermediate data.
- **Implementation.** [`artifact-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/artifact-store.ts#L20-L70).
- **Invariants.** Artifacts are indexed by task ID and timestamp.
- **Verification.** Artifact management tests verify retrieval and storage indexing.

### Section 84. Security of review context
- **Requirement.** Filter sensitive tokens, secrets, and unrelated files from A3 review context bundles.
- **Implementation.** [`review-context-builder.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/review-context-builder.ts#L40-L75).
- **Invariants.** Sensitive environment patterns and private key files are redacted.
- **Verification.** Context sanitizer tests assert redaction of secret patterns.

### Section 85. Provider independence
- **Requirement.** Prevent coupling to a specific AI vendor or API service.
- **Implementation.** [`agent-adapter.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/agent-adapter.ts), [`config.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/config/config.ts).
- **Invariants.** Orchestrator communicates through generic process or stream abstractions.
- **Verification.** Adapter tests confirm operational interchangeability.

### Section 86. Model independence
- **Requirement.** Support heterogeneous models across different roles without hardcoded assumptions.
- **Implementation.** [`config.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/config/config.ts), [`a1-worker.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a1-worker.ts), [`a2-planner.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a2-planner.ts), [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts).
- **Invariants.** Roles support distinct model configurations.
- **Verification.** Role configuration tests assert independent per-role model assignments.

---

## Part 14: Validation and system integrity (Sections 87 to 91)

### Section 87. AI output validation
- **Requirement.** Validate all AI outputs against strict schemas. Implement retry loops with prompt reinforcement. Escalate to block on repeated failures.
- **Implementation.** [`schemas.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/validation/schemas.ts), [`a2-planner.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a2-planner.ts#L90-L125), [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts#L95-L130).
- **Invariants.** Non-conforming JSON responses trigger schema retry loop. Escalates to `BLOCK` after 3 consecutive failures.
- **Verification.** Schema validation tests assert retry and escalation mechanics.

### Section 88. No hidden state transitions
- **Requirement.** Enforce that all state modifications occur through public state machine methods with event generation.
- **Implementation.** [`state-machine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/state-machine.ts), [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts).
- **Invariants.** Direct in-memory mutation without event emission is prohibited.
- **Verification.** State machine tests assert all transitions emit corresponding events.

### Section 89. Auditability
- **Requirement.** Maintain complete audit trail of prompts, outputs, diffs, transitions, and reviews.
- **Implementation.** [`event-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/event-store.ts), [`artifact-store.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/storage/artifact-store.ts).
- **Invariants.** Every operational action generates verifiable log records.
- **Verification.** Audit trail inspection tests verify end-to-end event chain.

### Section 90. Core safety principle
- **Requirement.** Prevent destructive workspace actions and protect repository integrity during failure scenarios.
- **Implementation.** [`workspace-lock.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/workspace-lock.ts), [`crash-recovery.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/crash-recovery.ts).
- **Invariants.** System halts or resets safely upon invariant violation.
- **Verification.** Safety boundary tests assert protection against unsafe operations.

### Section 91. Minimum required components
- **Requirement.** Implement all 25 core architectural components specified in the PRD without omission.
- **Implementation.** Verified in [`src/index.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/index.ts) and all core modules.
- **Invariants.** All 25 components exist as concrete classes or modules.
- **Verification.** Component integrity tests assert export and instantiation of all 25 components.

---

## Part 15: Algorithm, philosophy, and final architecture (Sections 92 to 96)

### Section 92. Core end-to-end algorithm
- **Requirement.** Implement the complete recursive autonomous execution loop.
- **Implementation.** [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts#L48-L215).
- **Invariants.** Coordinates planning, execution, review, remediation, reassessment, and final verification in exact algorithmic order.
- **Verification.** End-to-end test suite executes the complete algorithm.

### Section 93. The most important architectural rule
- **Requirement.** A1 performs work, A2 determines work, A3 verifies work, and Orchestrator controls state transitions.
- **Implementation.** [`orchestrator.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/orchestrator.ts), [`state-machine.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/state-machine.ts).
- **Invariants.** Inviolable boundary separation between roles and orchestration authority.
- **Verification.** Architectural tests verify strict boundary isolation.

### Section 94. Definition of complete
- **Requirement.** Completion requires satisfaction of original objective, satisfaction of discovered requirements, green tests, zero dead code, and clean git status.
- **Implementation.** [`final-verifier.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/final-verifier.ts).
- **Invariants.** Completion requires passing all 13 independent verification criteria.
- **Verification.** Final completion tests assert strict adherence to criteria.

### Section 95. Product philosophy
- **Requirement.** System operates with healthy skepticism, requires empirical evidence, and avoids optimism bias.
- **Implementation.** [`a3-reviewer.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/roles/a3-reviewer.ts), [`final-verifier.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/core/final-verifier.ts).
- **Invariants.** Evidence takes precedence over agent claims.
- **Verification.** Review logic tests confirm skeptical evaluation posture.

### Section 96. Final architecture
- **Requirement.** Unified, robust, extensible system architecture connecting storage, evidence, roles, analysis, and CLI.
- **Implementation.** [`index.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/index.ts), [`cli.ts`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/cli/cli.ts).
- **Invariants.** The complete system runs from clean CLI interface or programmatic TypeScript API.
- **Verification.** All automated unit, integration, and live E2E suites pass cleanly.
