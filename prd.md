# Sleekdo — Complete Product Requirements Document

## 1. Product Definition

Sleekdo is an agent orchestration and verification system that enables coding CLI agents to autonomously build, modify, debug, test, refactor, and complete projects of arbitrary size and type.

Sleekdo sits above coding CLI agents such as Pi, Claude Code, Agy, and arbitrary compatible CLI agents.

Sleekdo does not replace the coding agent.

Instead, it controls the development process around the coding agent.

The system consists of three logical AI roles:

* **A1 — Worker:** executes coding and development work.
* **A2 — Planner:** understands the user's objective, decomposes it into work, continuously reassesses remaining work, discovers newly required work, and maintains the global development plan.
* **A3 — Reviewer:** independently verifies A1's work using a fresh session and direct evidence from the project.

The central architectural principle is:

> **A1 performs work, A2 determines what work needs to exist, A3 independently determines whether completed work is actually correct, and the Sleekdo orchestrator is the authority that controls what work may proceed.**

Sleekdo must work for software projects of any category, including but not limited to:

* applications
* games
* websites
* APIs
* libraries
* CLIs
* operating-system components
* automation
* infrastructure
* data systems
* AI systems
* simulations
* plugins
* extensions
* research/code projects
* migrations
* refactors
* bug fixes
* large multi-system products

The system must not assume that a project has a fixed endpoint known at the beginning.

A2 must be capable of recursively discovering additional required work throughout development.

---

# 2. Primary Objective

Given a user request, Sleekdo must be capable of autonomously progressing from:

```text
USER REQUEST
    ↓
UNDERSTANDING
    ↓
PLAN
    ↓
PLAN VERIFICATION
    ↓
TASK
    ↓
IMPLEMENTATION
    ↓
INDEPENDENT REVIEW
    ↓
CORRECTION
    ↓
REVIEW
    ↓
APPROVAL
    ↓
REASSESS GLOBAL PROJECT
    ↓
NEW TASKS / NEXT TASK
    ↓
IMPLEMENTATION
    ↓
...
    ↓
FINAL SYSTEM VERIFICATION
    ↓
COMPLETION
```

The system must continue until the original objective and all subsequently discovered requirements are satisfied, or until it encounters a condition that genuinely requires user input or cannot safely be resolved autonomously.

Completion must never mean merely:

> "The initial TODO list is empty."

Completion means:

> "The system has independently determined that the original user request and all necessary resulting requirements are satisfied, the implementation is integrated, relevant tests and runtime behavior are correct, unnecessary code/files have been identified and removed or justified, and no known blocking work remains."

---

# 3. Core Roles

## 3.1 A1 — Worker

A1 is the coding agent.

A1 should behave like a normal coding CLI agent.

A1 does not need to know that Sleekdo exists.

A1 does not need to know:

* the complete project plan
* future tasks
* A3's identity
* A3's reasoning
* the internal Sleekdo state
* the supervision mechanism
* other tasks unless relevant to the current task

A1 receives an authorized work item from the orchestrator and executes it using its normal tools.

A1 may:

* inspect files
* create files
* modify files
* delete files
* execute commands
* run tests
* inspect runtime behavior
* debug
* refactor
* implement features
* fix bugs
* perform migrations
* use project tools

A1 may not:

* approve its own work
* advance itself to another task
* alter task state
* bypass A3
* modify Sleekdo state
* declare another task complete
* permanently skip work
* redefine the project requirements

A1's statements about what it accomplished are evidence, not authoritative truth.

---

# 4. A2 — Planner

A2 is responsible for understanding and planning the project.

A2 must operate at two levels:

### Global planning

Understand the entire project and maintain the evolving roadmap.

### Local planning

Determine exactly what the next work item should accomplish.

A2 must continuously reassess the project rather than assuming the original plan remains complete forever.

---

# 5. A3 — Reviewer

A3 is the independent verification agent.

A3 must receive a fresh clean session for each review.

A3 must not rely on conversational memory from previous reviews.

A3 receives the required project information through a generated review context.

A3 must independently inspect the actual implementation.

A3 must not simply accept A1's report.

A3 must determine whether:

* the task requirements were satisfied
* acceptance criteria were satisfied
* the implementation actually exists
* claimed changes actually occurred
* tests are meaningful
* tests pass
* the implementation integrates correctly
* scope was respected
* unnecessary changes were introduced
* regressions were introduced
* the implementation creates dead code/files
* the task is actually complete

A3 may approve, reject, block, or request clarification.

A3 must not reject a task merely because it would personally implement it differently.

---

# 6. Orchestrator

The orchestrator is the authority of the system.

Neither A1, A2, nor A3 directly controls task-state transitions.

The orchestrator:

* receives the user request
* starts A2 planning
* manages the plan
* assigns work to A1
* monitors A1
* detects worker-turn completion
* collects evidence
* freezes workspaces during review
* creates A3 review sessions
* supplies A3 with review context
* validates A3's structured result
* updates Sleekdo
* creates remediation tasks
* asks A2 to reassess the project
* determines what task may execute next
* prevents task skipping
* handles retries
* handles escalation
* handles crashes
* performs final verification
* determines project completion

The orchestrator must be the only authority capable of advancing the workflow.

---

# 7. Fundamental State Invariant

The system must enforce:

> **No work item may be considered complete or allow dependent work to proceed until it has reached a valid terminal state through the orchestrator.**

A normal task lifecycle is:

```text
PENDING
  ↓
READY
  ↓
IN_PROGRESS
  ↓
AWAITING_REVIEW
  ↓
APPROVED
```

A rejected task follows:

```text
AWAITING_REVIEW
  ↓
REJECTED
  ↓
REMEDIATION_REQUIRED
  ↓
SUBTASKS_CREATED
  ↓
IN_PROGRESS
  ↓
AWAITING_REVIEW
```

A task may become:

```text
BLOCKED
```

or:

```text
DEFERRED
```

only through explicit orchestration rules.

There must be no valid transition:

```text
IN_PROGRESS → NEXT_TASK
```

without approval or explicitly authorized deferral.

---

# 8. Recursive Project Planning

The initial plan must not be treated as the complete project definition.

A2 must continuously reassess the project after meaningful completed work.

Example:

```text
User request
    ↓
A2 creates Tasks 1–10
    ↓
Tasks 1–4 completed
    ↓
A2 reassesses project
    ↓
Discovers Tasks 11–15 are required
    ↓
Adds them
    ↓
Tasks 5–10 continue
    ↓
A2 reassesses again
    ↓
New integration work discovered
    ↓
Adds Tasks 16–19
```

This recursive planning capability is mandatory.

A2 must be able to:

* create tasks
* split tasks
* merge tasks when appropriate
* create subtasks
* create remediation tasks
* create integration tasks
* create regression tasks
* create refactoring tasks
* create testing tasks
* create cleanup tasks
* discover missing requirements
* discover dependencies
* reprioritize pending work
* identify obsolete tasks
* identify tasks that are no longer necessary
* identify newly exposed work
* update acceptance criteria when legitimate new information changes the implementation requirements

A2 must never remove required work merely to declare the project complete.

---

# 9. Recursive Planning Loop

After meaningful task completion, the orchestrator must invoke A2 for project reassessment.

A2 receives:

* original user request
* current project state
* approved task history
* outstanding requirements
* current architecture
* current implementation state
* known defects
* previous review findings
* current tests
* current repository state
* unresolved blockers
* newly discovered behavior
* relevant Sleekdo state

A2 must answer:

1. What requirements remain incomplete?
2. What newly discovered requirements are necessary to satisfy the original request?
3. What integration work remains?
4. What defects remain?
5. What tests are missing?
6. What refactoring is required?
7. What dead code/files exist?
8. What tasks are obsolete?
9. What dependencies prevent remaining work?
10. Is the project actually complete?

A2 must create additional work whenever necessary.

---

# 10. Plan Approval

Before A1 begins implementation, A2 must produce an initial plan.

The plan must contain:

* task IDs
* objectives
* requirements
* acceptance criteria
* dependencies
* constraints
* expected outputs
* relevant integration considerations

A3 must independently review the initial plan before execution begins.

The plan must not be considered authorized until approved.

If A3 rejects the plan, A2 must revise it.

A3 must reject only concrete planning deficiencies such as:

* missing explicit requirements
* impossible ordering
* missing critical integration work
* missing acceptance criteria
* contradictory tasks
* unnecessary scope
* inadequate testing strategy
* clearly missing project-level requirements

---

# 11. Task Definition

Every work item must have a stable identity.

Example:

```yaml
id: task_001
parent_id: null
type: task

title: Implement authentication

objective: >
  Implement authentication required by the project.

requirements:
  - users can authenticate
  - credentials are validated
  - invalid credentials are rejected

acceptance_criteria:
  - authentication endpoint exists
  - successful authentication behaves correctly
  - invalid authentication is rejected
  - appropriate tests exist
  - implementation integrates with existing application

dependencies:
  - task_000

status: pending
```

Subtasks must preserve parent relationships.

```text
task_004
 ├── task_004.1
 ├── task_004.2
 └── task_004.3
```

---

# 12. A1 Task Isolation

A1 should normally receive only the current authorized task.

A1 may receive:

* current objective
* current acceptance criteria
* relevant constraints
* necessary project context
* relevant existing architectural information
* remediation requirements if correcting a rejected task

A1 should not receive the entire future roadmap unless required.

This reduces:

* distraction
* premature implementation
* scope expansion
* accidental task skipping
* unnecessary context consumption

---

# 13. A1 Completion Detection

A1 must not manually control task completion.

The Agent Adapter must detect worker-turn completion.

Completion detection should use the strongest available mechanism.

Priority:

1. Native agent lifecycle events
2. Structured agent events
3. Process state
4. PTY state
5. terminal/prompt detection
6. other reliable harness-specific mechanisms

The system must distinguish:

```text
TURN_COMPLETE
```

from:

```text
TOOL_RUNNING
PROCESS_RUNNING
WAITING_FOR_INPUT
COMMAND_RUNNING
```

A lack of output alone must never be interpreted as task completion.

A1's own statement that it is finished may be recorded as evidence but must not independently trigger approval.

---

# 14. Agent Adapter Architecture

Sleekdo must support arbitrary coding CLI agents through an adapter interface.

Conceptual interface:

```typescript
interface AgentAdapter {
  start(config): Promise<AgentSession>;
  send(session, input): Promise<void>;
  interrupt(session): Promise<void>;
  stop(session): Promise<void>;
  isAlive(session): Promise<boolean>;
  events(session): AsyncIterable<AgentEvent>;
  detectTurnCompletion(session): Promise<boolean>;
}
```

Adapters may include:

```text
GenericPTYAdapter
PiAdapter
ClaudeCodeAdapter
AgyAdapter
CustomAdapter
```

The generic adapter must allow arbitrary CLI commands.

The core Sleekdo architecture must not depend on any particular coding agent.

---

# 15. Evidence Collection

A1 output is not sufficient evidence.

The orchestrator must collect objective evidence.

Evidence can include:

* filesystem snapshots
* file creation
* file modification
* file deletion
* directory creation/deletion
* Git status
* Git diff
* commit information
* commands
* command exit codes
* command output
* test results
* build results
* runtime output
* process information
* generated artifacts
* dependency changes
* configuration changes

A3 must be able to inspect actual project state.

---

# 16. Before/After Workspace Snapshots

Before assigning a task, the system should capture a workspace baseline.

After A1 stops working, capture the resulting state.

The system must calculate:

* created files
* modified files
* deleted files
* created directories
* deleted directories
* changed dependencies
* changed configuration
* relevant Git changes

This evidence becomes part of the A3 review context.

---

# 17. Sleekdo Data Architecture

Sleekdo must not be one enormous transcript file.

Use three logical layers:

```text
CURRENT STATE
EVENT HISTORY
ARTIFACT/EVIDENCE STORAGE
```

Suggested structure:

```text
.sleekdo/
    state.json
    events.jsonl
    reviews/
    artifacts/
    snapshots/
    locks/
```

`state.json` contains compact current state.

`events.jsonl` contains append-only history.

Artifacts contain large outputs.

Snapshots contain workspace-state information.

Reviews contain structured A3 results.

---

# 18. Sleekdo State

Sleekdo must maintain:

* original request
* project identity
* plan
* tasks
* subtasks
* dependencies
* current task
* task statuses
* acceptance criteria
* review results
* remediation requirements
* blockers
* deferrals
* planning revisions
* project completion state
* global outstanding requirements
* cleanup findings
* final verification state

Approved tasks remain in Sleekdo.

Their temporary execution transcript should be compacted after approval.

---

# 19. Event Log

Important events include:

```text
USER_REQUEST
PLAN_CREATED
PLAN_REVISED
PLAN_APPROVED
PLAN_REJECTED

TASK_CREATED
TASK_STARTED
TASK_COMPLETION_CANDIDATE
TASK_REVIEW_STARTED
TASK_APPROVED
TASK_REJECTED
TASK_BLOCKED
TASK_DEFERRED

SUBTASK_CREATED
SUBTASK_STARTED
SUBTASK_APPROVED
SUBTASK_REJECTED

A1_MESSAGE
A1_TOOL_CALL
A1_TOOL_RESULT

FILE_CREATED
FILE_MODIFIED
FILE_DELETED

COMMAND_STARTED
COMMAND_FINISHED

TEST_STARTED
TEST_FINISHED

A3_REVIEW_STARTED
A3_APPROVED
A3_REJECTED

PROJECT_REASSESSMENT
PROJECT_COMPLETION_CHECK
PROJECT_APPROVED
PROJECT_BLOCKED
```

---

# 20. A3 Review Context

Every A3 session must receive a fresh review context.

The context must contain enough information to independently evaluate the work.

At minimum:

```text
Original user requirements
Current task
Acceptance criteria
Relevant constraints
Relevant task dependencies
Relevant Sleekdo state
A1 summary
Changed files
Filesystem evidence
Git diff
Relevant commands
Test results
Relevant existing code
Previous findings for the current task
```

A3 must be able to inspect additional project files when necessary.

---

# 21. A3 Fresh Session Requirement

Each task or subtask review must use a clean A3 session.

After the review decision:

* persist the structured result
* persist evidence references
* destroy the A3 session/context

The next review must not inherit conversational memory from the previous review.

Only persistent project state and evidence may carry forward.

---

# 22. A3 Review Policy

A3 must verify:

### Requirement compliance

Does the implementation satisfy the explicit requirement?

### Acceptance criteria

Are all criteria satisfied?

### Actual implementation

Does the claimed implementation actually exist?

### Runtime behavior

Does the implementation behave correctly?

### Testing

Are appropriate tests present and passing?

### Regression

Did the change break existing behavior?

### Integration

Does the implementation work with the rest of the project?

### Scope

Did the worker introduce unnecessary functionality?

### Architecture

Does the implementation fit the existing system?

### Cleanup

Did the implementation create dead code, dead files, unused dependencies, obsolete paths, or redundant functionality?

### Completeness

Was anything required by the task forgotten?

A3 must approve valid implementations even when another implementation style might also be possible.

---

# 23. A3 Decisions

A3 must return structured decisions:

```text
APPROVE
REJECT
BLOCK
```

### APPROVE

The task satisfies its requirements.

### REJECT

There is a concrete issue requiring correction.

### BLOCK

The task cannot safely proceed because of an external or unresolved dependency.

A3 must provide concrete evidence for rejection.

---

# 24. Rejection Requirements

A rejection must include:

* problem
* evidence
* affected requirement
* required correction
* acceptance condition for the correction

Example:

```json
{
  "decision": "reject",
  "blocking_issues": [
    {
      "description": "Expired tokens are accepted.",
      "evidence": "src/auth/token.ts:51",
      "required_fix": "Reject expired tokens.",
      "verification": "Add and pass an expired-token regression test."
    }
  ]
}
```

A vague rejection such as:

> "The implementation isn't good."

is invalid.

---

# 25. Preventing Endless Review Loops

A3 must not become arbitrarily strict.

The system must distinguish between:

```text
blocking defect
```

and:

```text
preference
```

A3 should reject only when a concrete issue materially prevents satisfying the requirement.

The system must track repeated rejections.

If a work item repeatedly fails review, the orchestrator must escalate rather than indefinitely cycling.

Escalation may trigger:

* A2 reassessment
* expanded diagnostics
* alternative implementation strategy
* user clarification
* manual intervention

---

# 26. Evidence-Driven Debugging System

Sleekdo must impose a disciplined debugging methodology on A1 and A2.

When a defect is discovered, agents must not immediately begin changing code based on an unverified hypothesis.

The required debugging principle is:

> **Determine the actual failure mechanism before designing the fix.**

---

# 27. Binary-Search Debugging

When the cause of a problem is unclear, the agent should:

1. Define the observed failure.
2. Establish the expected behavior.
3. Identify candidate causal mechanisms.
4. Partition the remaining hypothesis space.
5. Choose the diagnostic step that eliminates the largest amount of uncertainty.
6. Obtain evidence.
7. Eliminate hypotheses inconsistent with the evidence.
8. Repeat until one plausible mechanism survives.
9. Confirm the surviving mechanism with runtime or direct implementation evidence.
10. Only then design the fix.

Conceptually:

```text
Observed failure
       ↓
Candidate causes
 ┌─────┼─────┐
 A     B     C
       ↓
Diagnostic evidence
       ↓
Eliminate impossible causes
       ↓
Remaining causes
    ┌────┴────┐
    D         E
    ↓
More evidence
    ↓
Surviving mechanism
    ↓
Confirm mechanism
    ↓
Design fix
```

The goal is to minimize wasted implementation.

---

# 28. Maximum-Information Diagnostics

Each debugging step should prefer the action that most effectively reduces uncertainty.

Examples:

Instead of changing five files:

```text
instrument subsystem boundary
run failing scenario
observe actual state
```

Instead of guessing whether the database or API is responsible:

```text
inspect request
inspect database query
compare returned state
```

Instead of rewriting an algorithm:

```text
capture actual input
capture intermediate state
capture output
```

The debugging strategy should favor high-information diagnostics.

---

# 29. Runtime Evidence

When program state is unclear, the agent must be allowed and encouraged to add temporary instrumentation.

Examples:

* logging
* assertions
* tracing
* state dumps
* request/response capture
* timing information
* subsystem boundary instrumentation
* debug counters
* temporary diagnostic scripts

The agent must run the program and inspect the resulting evidence.

Instrumentation that is no longer needed must be removed unless it is intentionally part of the final system.

---

# 30. No Guess-Driven Debugging

Agents must not perform long chains of speculative changes such as:

```text
Maybe A
→ change A
→ still broken
→ maybe B
→ change B
→ still broken
→ change C
→ ...
```

without learning from the result.

Every meaningful diagnostic action should either:

* test a hypothesis
* eliminate a hypothesis
* confirm a mechanism
* expose new evidence

If an attempt produces no useful information, the next step should change the diagnostic strategy.

---

# 31. Mechanism Confirmation Before Fix

The system must distinguish:

```text
CAUSE HYPOTHESIS
```

from:

```text
CONFIRMED CAUSE
```

A1 should not implement a substantial fix based solely on a plausible hypothesis.

Before designing a consequential fix, the actual mechanism should be confirmed through:

* runtime evidence
* tests
* tracing
* direct source analysis
* reproducible behavior
* controlled experiments
* subsystem isolation

A plausible but unconfirmed cause must not be treated as fact.

---

# 32. Debugging State

Sleekdo should track debugging investigations.

Example:

```yaml
investigation:
  id: investigation_12
  task_id: task_031

  observed_failure:
    expected: "request succeeds"
    actual: "request returns 500"

  hypotheses:
    - id: H1
      description: "database connection failure"
      status: eliminated
      evidence: "database query succeeds"

    - id: H2
      description: "serialization failure"
      status: surviving

    - id: H3
      description: "authentication middleware failure"
      status: eliminated

  confirmed_mechanism:
    description: "response serializer receives invalid object shape"
    evidence:
      - runtime_trace_22
      - test_case_31

  fix:
    status: planned
```

This makes debugging auditable and prevents circular reasoning.

---

# 33. Fix Isolation

When fixing a confirmed defect, the agent should modify the smallest reasonable set of components necessary to correct the actual mechanism.

A1 must avoid unrelated modifications.

A3 must inspect whether the fix changed unrelated areas.

If unrelated changes are found, A3 may require them to be reverted unless justified.

---

# 34. Recurring Dead-Code Analysis

Dead-code and dead-file analysis is a mandatory recurring verification activity.

It must not happen only at the end.

Large projects accumulate:

* unused files
* obsolete modules
* abandoned implementations
* unused functions
* unused classes
* unreachable branches
* stale configuration
* unused dependencies
* duplicate functionality
* obsolete tests
* temporary debugging code
* generated artifacts that should not exist
* old migration paths
* abandoned experiments

Sleekdo must actively detect these.

---

# 35. Dead-Code Verification Triggers

Dead-code analysis must occur:

* after significant architectural changes
* after major feature completion
* after refactoring
* after removing functionality
* after resolving large bugs
* during project reassessment
* before major final verification
* during final verification

The orchestrator should also schedule cleanup when evidence indicates likely dead code.

---

# 36. Dead-Code Analysis

A2 should identify candidates using:

* static analysis
* language tooling
* compiler warnings
* unused symbol detection
* import graph analysis
* dependency analysis
* reference search
* route analysis
* build graph analysis
* test coverage information
* runtime traces
* package dependency analysis
* configuration references
* generated-file analysis

A3 independently verifies cleanup decisions where appropriate.

---

# 37. Dead-Code Must Not Be Removed Blindly

A candidate is not automatically dead merely because static analysis cannot find a reference.

Potentially dynamic systems may use:

* reflection
* dynamic imports
* plugin discovery
* configuration-based loading
* dependency injection
* route registration
* event registration
* external consumers
* generated references
* runtime discovery

Therefore the system must classify candidates:

```text
CONFIRMED DEAD
PROBABLY DEAD
DYNAMICALLY REFERENCED
UNKNOWN
REQUIRED
```

Only sufficiently verified dead code should be automatically removed.

---

# 38. Dead-File Analysis

The same process applies to files.

For each candidate:

```text
file
 ↓
reference analysis
 ↓
import/dependency analysis
 ↓
configuration analysis
 ↓
runtime relevance
 ↓
build relevance
 ↓
external/API relevance
 ↓
classification
```

A3 must verify cleanup where the consequences could be significant.

---

# 39. Cleanup Tasks

Cleanup must become normal work items.

Example:

```text
Task 82:
Remove confirmed obsolete authentication adapter.

Subtasks:
82.1 Verify no runtime references.
82.2 Verify no build references.
82.3 Remove adapter.
82.4 Remove obsolete tests.
82.5 Remove obsolete dependency.
82.6 Run regression tests.
```

Cleanup must itself go through:

```text
A1 → A3 → approval
```

---

# 40. Final Dead-Code Sweep

Before final project completion:

A2 must perform a project-wide cleanup analysis.

It must identify:

* dead files
* dead functions
* dead classes
* unused imports
* unused dependencies
* obsolete configurations
* obsolete tests
* duplicated implementations
* temporary diagnostics
* abandoned migration code
* stale documentation where applicable
* generated artifacts that should not remain

Any confirmed unnecessary material must either:

1. be removed, or
2. have a documented justification for remaining.

A3 must independently review the final cleanup result.

---

# 41. Global Reassessment

After approved work, A2 must periodically perform a complete project reassessment.

This is not merely:

> "What's the next task?"

It is:

> "Given everything now known, what is required for the entire user objective to be genuinely complete?"

A2 must compare:

```text
Original request
+
current implementation
+
approved work
+
known defects
+
newly discovered requirements
+
integration state
+
tests
+
runtime behavior
+
cleanup state
```

against the desired final state.

---

# 42. Newly Discovered Requirements

If implementing one feature exposes another necessary requirement, A2 must create it.

Example:

```text
User requests:
"Add multiplayer."

A2 initially plans:
- networking
- player synchronization
- session management

Implementation reveals:
- state persistence is required for reconnect
- authority validation is required
- disconnect recovery is required

A2 must create those tasks.
```

The project must not be declared complete simply because those tasks were absent from the original plan.

---

# 43. No Premature Completion

The system must not declare completion because:

* the initial task list is empty
* all originally planned tasks passed
* A1 says it is finished
* tests happen to pass
* the build succeeds
* the project compiles
* A3 approved the previous task

Completion requires global verification.

---

# 44. Final Completion Verification

A final clean A3 session must evaluate:

### Original request

Does the implementation satisfy the user's actual request?

### Requirements

Are all explicit requirements fulfilled?

### Discovered requirements

Were all necessary requirements discovered during implementation fulfilled?

### Integration

Do all major systems work together?

### Runtime

Does the system behave correctly in realistic execution?

### Tests

Are appropriate tests passing?

### Regression

Did the final implementation preserve existing required functionality?

### Scope

Was unnecessary functionality avoided?

### Cleanup

Are dead files/code/dependencies removed or justified?

### Architecture

Is the resulting implementation internally coherent?

### Operational state

Can the project actually be built/run/used as required?

Only then can the orchestrator declare:

```text
PROJECT_COMPLETE
```

---

# 45. Completion Must Be Evidence-Based

The final decision must include evidence.

Example:

```yaml
completion:
  status: complete

  requirements:
    total: 47
    satisfied: 47

  tests:
    passed: 318
    failed: 0

  build:
    status: passed

  runtime:
    status: verified

  cleanup:
    dead_code_candidates: 31
    confirmed_removed: 27
    retained_with_justification: 4

  final_review:
    reviewer: A3
    decision: approved
```

---

# 46. User Clarification

The system should ask the user only when autonomous resolution is genuinely impossible or when the user's intent is materially ambiguous.

Examples:

* two requirements directly contradict each other
* required external information is unavailable
* a destructive decision requires user authorization
* an external service/account is required and inaccessible
* multiple interpretations produce materially different products
* the user must provide a required asset or credential

The system should not ask the user for ordinary engineering decisions that A2/A1 can reasonably resolve.

---

# 47. Permission and Safety Boundaries

Sleekdo must distinguish between:

```text
authorized project operations
```

and:

```text
operations requiring explicit user approval
```

The system must allow configurable policies for:

* filesystem access
* network access
* package installation
* shell commands
* external services
* destructive operations
* secrets
* deployment
* production environments

A3 cannot authorize an operation that the system policy prohibits.

---

# 48. Workspace Isolation

A1 must not have write access to Sleekdo's control state.

The following must be protected from A1:

```text
.sleekdo/state
.sleekdo/events
.sleekdo/reviews
orchestrator state
A3 state
A2 planning state
task authorization
```

A1 should only receive access to the project workspace and tools it is authorized to use.

---

# 49. Review-Time Workspace Freeze

When A3 reviews a task:

```text
A1 = paused
workspace = frozen
A3 = active
```

No project mutation may occur while A3 is reviewing.

After A3 returns its decision:

```text
persist review
update Sleekdo
destroy A3 session
unlock workspace
```

This prevents review races.

---

# 50. Review Identity

Each review must record:

```yaml
review:
  id: review_019
  task_id: task_019
  sleekdo_revision: 412
  workspace_snapshot: sha256:...
  reviewer_provider: ...
  reviewer_model: ...
  started_at: ...
  completed_at: ...
```

This establishes exactly what A3 reviewed.

---

# 51. State Revisioning

Every important Sleekdo state mutation must have a revision.

Example:

```text
revision 101
revision 102
revision 103
```

A review should refer to a specific state revision.

This allows the system to determine whether the reviewed state is still current.

If the workspace changes after a review context is created, that review becomes invalid.

---

# 52. Crash Recovery

Sleekdo must survive:

* A1 crashes
* A2 crashes
* A3 crashes
* CLI crashes
* machine restart
* network failure
* provider failure
* command timeout
* process termination
* corrupted temporary session

Persistent state must allow the orchestrator to determine:

* what task was active
* whether A1 was running
* whether A1 had stopped
* whether review had begun
* whether review completed
* what evidence existed
* whether the workspace changed

The system must never assume completion after an ambiguous crash.

---

# 53. Idempotency

Operations must be safe to retry.

Examples:

```text
create task
record review
persist event
capture snapshot
start review
```

The system must prevent duplicate task creation or duplicate state transitions after retries.

Every important operation needs a stable identifier.

---

# 54. Parallelism

The initial control model is sequential per workspace:

```text
A1
 ↓
A3
 ↓
A1
 ↓
A3
```

However, the architecture must support future parallel work where tasks are demonstrably independent.

Parallel work must require:

* dependency analysis
* isolated workspaces or branches
* independent review
* merge/integration review
* conflict resolution
* final system verification

Parallelism must never weaken task authorization or verification.

---

# 55. Git Integration

When Git is present, Sleekdo should integrate with it.

Useful information includes:

* branch
* commit
* status
* diff
* changed files
* history
* merge state

Sleekdo must not require Git for basic operation.

Filesystem-based evidence must remain available.

---

# 56. Testing Strategy

Testing must be task-specific and system-level.

A2 should determine appropriate testing requirements.

Possible levels:

```text
unit
integration
end-to-end
runtime
performance
regression
static analysis
build verification
```

A3 must verify that tests actually provide meaningful evidence rather than merely checking that some command exits successfully.

---

# 57. Test Gap Detection

A3 should identify situations where:

```text
implementation exists
but
critical behavior has no meaningful verification
```

A3 can reject a task when a missing test represents a material requirement.

A2 should then create testing work.

---

# 58. Regression Protection

When fixing a bug:

```text
reproduce bug
→ confirm mechanism
→ implement fix
→ verify fix
→ add regression test where appropriate
→ run relevant existing tests
→ A3 review
```

This prevents a fix from disappearing later.

---

# 59. Refactoring

Refactoring must be treated as controlled work.

A1 should not perform broad unrelated refactoring while implementing a task.

If a refactor is necessary:

```text
A2 creates/refines task
→ A1 performs refactor
→ A3 verifies behavior preservation
```

Large refactors must include regression verification.

---

# 60. Scope Control

Every task must define what is inside and outside its scope when useful.

A3 should flag:

* unrelated features
* unnecessary dependencies
* unrelated architecture changes
* unnecessary rewrites
* unrelated file modifications

A2 may determine that a broader change is necessary, in which case it must explicitly create or expand the relevant task rather than allowing A1 to silently expand scope.

---

# 61. Temporary Artifacts

A1 may create temporary:

* logs
* scripts
* diagnostic files
* debug instrumentation
* generated output

These must be classified.

Before task approval:

```text
temporary and unnecessary → remove
temporary but useful → justify
required final artifact → retain
```

The final cleanup sweep must detect leftovers.

---

# 62. A2 Planning Rules

A2 should:

* prefer the smallest coherent task
* preserve dependencies
* avoid unnecessary decomposition
* avoid enormous tasks that cannot be independently verified
* avoid excessive microtasks
* include acceptance criteria
* account for integration
* account for testing
* account for cleanup
* revisit assumptions when evidence changes
* create new work when implementation reveals it
* remove obsolete work when legitimately no longer required

A2 must optimize for successful completion, not maximum task count.

---

# 63. A3 Review Rules

A3 should:

* trust evidence over claims
* inspect actual implementation
* verify requirements
* verify acceptance criteria
* verify runtime behavior where appropriate
* identify regressions
* identify scope expansion
* identify dead code/files
* identify incomplete work
* distinguish defects from preferences
* avoid unnecessary rejection
* provide actionable remediation
* confirm fixes using evidence

A3 must not invent requirements that do not arise from the user's request, necessary system behavior, or explicitly established project constraints.

---

# 64. A1 Execution Rules

A1 should:

* work only on the authorized task
* inspect existing code before modifying it
* preserve existing functionality
* use appropriate tests
* diagnose failures using evidence
* confirm mechanisms before major fixes
* avoid unrelated modifications
* clean temporary debugging changes
* report what it believes it accomplished

A1's report remains non-authoritative.

---

# 65. Agent Prompt Separation

Prompts should be separated by role.

```text
prompts/
    a1-worker.md
    a2-planner.md
    a3-reviewer.md
```

The prompts must not contain unnecessary role leakage.

A1 should not be told about A3.

A3 should not rely on A1's internal reasoning.

A2 should reason about project-level planning rather than directly performing every implementation step.

---

# 66. A1 Prompt Contract

A1 receives:

```text
CURRENT TASK
OBJECTIVE
REQUIREMENTS
ACCEPTANCE CRITERIA
CONSTRAINTS
RELEVANT CONTEXT
REMEDIATION REQUIREMENTS
```

A1 is instructed to implement the task and verify its work.

---

# 67. A2 Prompt Contract

A2 receives:

```text
ORIGINAL USER REQUEST
CURRENT PROJECT STATE
PLAN
APPROVED WORK
OUTSTANDING WORK
CURRENT IMPLEMENTATION
KNOWN ISSUES
TEST STATE
CLEANUP STATE
PREVIOUS REVIEW FINDINGS
```

A2 is instructed to reason about what must happen next.

---

# 68. A3 Prompt Contract

A3 receives:

```text
ORIGINAL USER REQUIREMENTS
CURRENT TASK
ACCEPTANCE CRITERIA
RELEVANT CONTEXT
SLEEKDO STATE
A1 SUMMARY
ACTUAL CHANGES
FILES
DIFFS
COMMAND RESULTS
TEST RESULTS
```

A3 is instructed:

> Determine whether the work is actually complete based on evidence. Do not trust the worker's claims without verification. Reject only concrete blocking problems.

---

# 69. Global Project State

The project should maintain:

```yaml
project:
  status:
    planning
    executing
    reviewing
    blocked
    final_verification
    complete

  requirements:
  tasks:
  discoveries:
  defects:
  cleanup:
  tests:
  architecture:
  completion:
```

---

# 70. Requirement Traceability

Every important requirement should be traceable.

```text
User requirement
    ↓
A2 plan
    ↓
Task
    ↓
Acceptance criteria
    ↓
Implementation
    ↓
Tests/evidence
    ↓
A3 approval
```

This prevents requirements from silently disappearing during a long project.

---

# 71. Requirement Coverage

Sleekdo should maintain a requirement matrix.

Example:

```yaml
requirement_001:
  description: "Users can authenticate."
  tasks:
    - task_012
    - task_013
  tests:
    - test_auth_01
    - test_auth_02
  status: satisfied
```

The final completion check must ensure no required item is orphaned.

---

# 72. Discovery Traceability

New requirements discovered during implementation must also be traceable.

```text
Original requirement
    ↓
Implementation discovery
    ↓
New necessary requirement
    ↓
A2 task
    ↓
A1 implementation
    ↓
A3 verification
```

This is what allows Sleekdo to grow a project intelligently instead of blindly following the initial TODO.

---

# 73. Completion as a Fixed-Point Process

The project should be considered complete only when repeated global reassessment produces no additional required work.

Conceptually:

```text
Current project
      ↓
A2 reassessment
      ↓
Required work?
   ┌──┴──┐
  YES    NO
   │      │
   ▼      ▼
create   final
tasks    verification
   │
   ▼
execute
   │
   ▼
review
   │
   └───────────────→ reassess again
```

The project reaches completion when:

```text
A2 finds no required remaining work
AND
A3 verifies the resulting system
AND
tests/runtime evidence support completion
AND
cleanup requirements are satisfied
```

---

# 74. Final Verification Must Be Fresh

The final A3 review must use a fresh session.

It must not rely on the accumulated conversational history of previous A3 sessions.

It must independently inspect the final project.

This prevents:

```text
"We approved all previous tasks, therefore the final project must be correct."
```

from becoming an assumption.

---

# 75. Observability

Sleekdo should expose:

```text
current task
current A1 state
current A2 planning state
current A3 review state
project completion percentage
requirements satisfied
requirements outstanding
tasks approved
tasks rejected
tasks blocked
active investigations
cleanup candidates
test status
```

The displayed progress must be evidence-based rather than a simplistic percentage of tasks completed.

---

# 76. Progress Must Not Be Measured Only by Task Count

For example:

```text
90 / 100 tasks complete
```

does not necessarily mean:

```text
90% complete
```

A2 should maintain requirement and dependency state.

The UI should prioritize:

* requirements satisfied
* blocking work
* active task
* outstanding requirements
* verification status
* known defects

rather than misleading task-count percentages.

---

# 77. Human Override

The user should be able to:

* pause
* resume
* cancel
* inspect
* provide clarification
* approve exceptional decisions
* authorize restricted operations
* modify requirements
* request replanning

A human override must be recorded in Sleekdo.

The system must distinguish user decisions from AI decisions.

---

# 78. Requirement Changes

If the user changes the request during development:

```text
new user input
    ↓
A2 reassessment
    ↓
impact analysis
    ↓
update requirements
    ↓
update tasks
    ↓
A3 verifies revised plan
    ↓
continue
```

The system must not blindly continue executing an obsolete plan.

---

# 79. Plan Versioning

Plans must be versioned.

```text
Plan v1
Plan v2
Plan v3
...
```

Each version records:

* changes
* reason
* affected requirements
* affected tasks
* approval state

---

# 80. Architecture Consistency

A2 must periodically examine whether accumulated implementation has caused architectural drift.

It should identify:

* duplicated systems
* conflicting abstractions
* unnecessary dependencies
* inconsistent patterns
* accidental coupling
* obsolete interfaces
* parallel implementations of the same responsibility

If architectural cleanup is necessary, A2 creates explicit work.

A3 verifies it.

---

# 81. Dependency Hygiene

The system must periodically analyze dependencies.

Identify:

* unused packages
* duplicate packages
* unnecessary packages
* incompatible versions
* transitive risks where relevant
* packages replaced by project-native functionality

A2 creates cleanup work where justified.

A3 verifies that removing dependencies does not break the system.

---

# 82. Documentation and Project Knowledge

Documentation should be treated as implementation only when required by the project.

A2 should create documentation tasks when documentation is necessary for:

* user operation
* API usage
* deployment
* maintenance
* architecture
* generated interfaces
* project handoff

A3 verifies important documentation claims against the actual implementation.

---

# 83. Artifact and Context Management

Large outputs must not be injected into every model context.

Use references:

```text
artifact_id
file_id
snapshot_id
command_id
test_id
review_id
```

A2/A3 can retrieve details when required.

This allows projects to become very large without making every AI context enormous.

---

# 84. Security of Review Context

A3 must not receive secrets unnecessarily.

The review-context builder should redact:

* credentials
* API keys
* private keys
* authentication tokens
* sensitive environment variables

unless the review genuinely requires them and policy explicitly permits access.

---

# 85. Provider Independence

A2 and A3 should also be provider-independent.

The system should allow:

```text
A1 provider: Claude
A2 provider: another model
A3 provider: another model
```

or:

```text
A1 provider: Pi
A2 provider: Claude
A3 provider: another provider
```

The architecture must not require all roles to use the same model.

---

# 86. Model Independence

The system must not assume that A1, A2, and A3 are equally capable.

Role-specific prompts and validation should compensate for differences.

Structured outputs must be schema-validated.

The orchestrator must reject malformed AI decisions.

---

# 87. AI Output Validation

Every structured A2/A3 response must be validated against a schema.

Invalid output:

```text
retry
```

Repeated invalid output:

```text
escalate
```

The system must never execute arbitrary AI-generated state transitions without validation.

---

# 88. No Hidden State Transitions

Every important transition must be represented explicitly.

For example:

```text
TASK_APPROVED
```

must be an event.

The system must not silently mutate:

```text
task.status = approved
```

without recording why.

---

# 89. Auditability

For every completed task, the system should be able to answer:

* What requirement caused this task to exist?
* What did A1 receive?
* What did A1 change?
* What commands were executed?
* What tests were run?
* What did A1 claim?
* What did A3 inspect?
* What evidence did A3 use?
* Why was it approved?
* If rejected, why?
* What remediation occurred?
* What final state was approved?

---

# 90. Core Safety Principle

A1, A2, and A3 are all fallible.

Therefore:

```text
AI statement
    ≠
system fact
```

System facts should come from:

* filesystem state
* process state
* command results
* test results
* source inspection
* runtime evidence
* structured persisted state

AI reasoning interprets evidence; it does not create reality.

---

# 91. Minimum Required Components

The implementation must contain:

```text
1. Orchestrator
2. Sleekdo state store
3. Event store
4. Task state machine
5. Recursive planner
6. A1 agent adapter
7. A2 planner runner
8. A3 reviewer runner
9. Review-context builder
10. Filesystem evidence engine
11. Git evidence engine
12. Command evidence engine
13. Test evidence engine
14. Workspace snapshot system
15. Workspace locking
16. Crash recovery
17. Schema validation
18. Requirement traceability
19. Debugging/investigation system
20. Dead-code analysis
21. Dead-file analysis
22. Cleanup task generation
23. Final verification
24. CLI interface
25. Configuration system
```

---

# 92. Core End-to-End Algorithm

The core orchestrator should behave conceptually as follows:

```text
RECEIVE USER REQUEST

↓

A2 understands request

↓

A2 creates initial requirements and plan

↓

A3 independently reviews plan

↓

If rejected:
    A2 revises plan
    A3 reviews again

↓

If approved:

    while project is not complete:

        A2 reassesses current project state

        discover:
            missing requirements
            new tasks
            dependencies
            defects
            integration work
            testing work
            cleanup work

        select next authorized READY work item

        capture workspace baseline

        start A1

        send only authorized work item

        monitor A1

        collect:
            messages
            tool calls
            commands
            files
            changes
            tests
            runtime evidence

        detect worker turn completion

        freeze workspace

        capture final workspace state

        create fresh A3 session

        construct review context

        A3 independently verifies task

        if APPROVED:
            persist approval
            compact temporary task transcript
            destroy A3 session
            unlock workspace
            continue

        if REJECTED:
            persist findings
            create remediation work
            destroy A3 session
            unlock workspace
            send remediation to A1
            continue

        if BLOCKED:
            persist blocker
            invoke A2
            resolve, defer, or request user input

        periodically:
            perform dead-code analysis
            perform dead-file analysis
            perform dependency analysis
            perform architecture reassessment
            perform requirement reassessment

↓

When A2 determines no required work remains:

    run final cleanup analysis

    perform required cleanup

    run full relevant test/build/runtime verification

    start fresh A3 final review

    A3 verifies:
        original request
        all requirements
        integration
        runtime
        tests
        regressions
        cleanup
        architecture
        completeness

    if approved:
        PROJECT_COMPLETE

    otherwise:
        return to A2
        create additional work
        continue loop
```

---

# 93. The Most Important Architectural Rule

The system must not be:

```text
Planner → TODO → Worker → Reviewer → Done
```

It must be:

```text
Planner
   ↓
Work
   ↓
Independent Verification
   ↓
Global Reassessment
   ↓
Discover More Work
   ↓
Work
   ↓
Independent Verification
   ↓
Global Reassessment
   ↓
...
   ↓
Final Verification
   ↓
Done
```

That distinction is what makes Sleekdo capable of handling projects whose true scope cannot be known completely at the beginning.

---

# 94. Definition of "Complete"

Sleekdo must only declare a project complete when all of the following are true:

```text
[✓] Original user requirements satisfied
[✓] Necessary discovered requirements satisfied
[✓] All required work items approved
[✓] No unresolved blocking defects
[✓] Required tests pass
[✓] Relevant runtime behavior verified
[✓] Integration verified
[✓] Regression checks completed
[✓] Dead-code analysis completed
[✓] Dead-file analysis completed
[✓] Unnecessary dependencies addressed
[✓] Temporary diagnostics cleaned
[✓] Scope is controlled
[✓] Architecture is coherent enough for the project's requirements
[✓] Final A3 review approved
```

Only the orchestrator may transition the project to:

```text
COMPLETE
```

---

# 95. Product Philosophy

Sleekdo should optimize for:

```text
correctness
+
evidence
+
completeness
+
controlled scope
+
continuous planning
+
independent verification
+
efficient debugging
+
clean implementation
```

rather than simply maximizing:

```text
lines of code
tasks completed
agent activity
```

The system's objective is not to make A1 work continuously.

The objective is to make the **correct project actually exist**.

---

# 96. Final Architecture

The final conceptual architecture is:

```text
                         USER
                           │
                           ▼
                  ┌─────────────────┐
                  │   ORCHESTRATOR  │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │      A2         │
                  │ GLOBAL PLANNER  │
                  │                 │
                  │ plan            │
                  │ decompose       │
                  │ reassess        │
                  │ discover        │
                  │ reprioritize    │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │     SLEEKDO     │
                  │                 │
                  │ state           │
                  │ requirements    │
                  │ tasks           │
                  │ dependencies    │
                  │ evidence        │
                  │ reviews         │
                  │ investigations  │
                  │ cleanup         │
                  └───────┬─────────┘
                          │
                    authorized work
                          │
                          ▼
                  ┌─────────────────┐
                  │      A1         │
                  │     WORKER      │
                  │                 │
                  │ code            │
                  │ test            │
                  │ debug           │
                  │ execute        │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │    EVIDENCE     │
                  │                 │
                  │ filesystem      │
                  │ git             │
                  │ commands        │
                  │ tests           │
                  │ runtime         │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │      A3         │
                  │    REVIEWER     │
                  │                 │
                  │ fresh session   │
                  │ inspect         │
                  │ verify          │
                  │ approve/reject  │
                  └────────┬────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │   ORCHESTRATOR  │
                  │                 │
                  │ approve         │
                  │ remediate       │
                  │ replan          │
                  │ continue        │
                  └────────┬────────┘
                           │
                           └───────────────┐
                                           │
                                           ▼
                                   GLOBAL REASSESSMENT
                                           │
                                           ▼
                                  MORE WORK OR COMPLETE
```

## Final governing principle

**A1 should never be trusted to decide what the project needs next, A2 should never be trusted to declare its own plan correct, A3 should never be trusted merely because it is a reviewer, and no AI should be trusted merely because it claims something happened; Sleekdo must continuously turn requirements into authorized work, work into observable evidence, evidence into independently verified results, and verified results back into global planning until the entire system reaches a demonstrably complete state.**

# 97. Sleekdo-native CLI


There are two good interface models:

1. **Sleekdo-native CLI — recommended**

   ```bash
   sleekdo --pi
   sleekdo --agy
   sleekdo --claude
   ```

   This launches Sleekdo's own interactive terminal UI. Sleekdo asks for the project/request, displays progress, task state, reviews, errors, etc., while internally launching and controlling the selected agent CLI.

2. **Sleekdo with an explicit provider**

   ```bash
   sleekdo pi
   sleekdo agy
   sleekdo claude
   ```

   Same concept, just a cleaner subcommand architecture.

I would **not** make the third model—where you have to do something like `echo "build X" | sleekdo --pi` or manually send prompts through the underlying CLI—the primary interface.

### Recommended UX

```text
$ sleekdo --pi

╭──────────────────────────────────────────────╮
│ SLEEKDO                                      │
│ Agent: Pi                                    │
│ Project: my-project                          │
╰──────────────────────────────────────────────╯

What do you want to build?

> Build a complete inventory system with authentication,
  persistence, tests, and an admin interface.

Sleekdo is planning...

✓ Requirements extracted
✓ Initial plan created
✓ Plan independently reviewed

Tasks
  ✓ T001 Project architecture
  → T002 Authentication
  ○ T003 Database layer
  ○ T004 Inventory system
  ○ T005 Admin interface
  ○ T006 Integration & verification

A1 Worker: Pi
A3 Reviewer: active

T002 Authentication
  Worker: implementing...
  Tests: running...
  Review: pending...

[██████████████░░░░░░░░] 58%

sleekdo>
```

The important distinction is that **Pi/Agy/Claude are execution backends**, while **Sleekdo owns the user-facing session**.

So the architecture should be:

```text
                 YOU
                  │
                  ▼
        ┌─────────────────┐
        │  Sleekdo CLI/UI │
        │  User Interface │
        └────────┬────────┘
                 │
        ┌────────▼────────┐
        │ A2 Orchestrator │
        │ Planning/State  │
        └───────┬─────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
   ┌───────┐         ┌───────┐
   │  A1   │         │  A3   │
   │ Worker│         │Review │
   │  Pi   │         │ Fresh │
   └───────┘         └───────┘
```

### Commands I'd specify in the PRD

```bash
sleekdo --pi
sleekdo --agy
sleekdo --claude
```

and optionally:

```bash
sleekdo --provider pi
sleekdo --provider agy
sleekdo --provider claude
```

Then inside the Sleekdo interface:

```text
sleekdo> build a complete inventory system
```

or simply launch directly into the request screen.

Sleekdo should also support normal CLI commands **inside its own interface**, for example:

```text
sleekdo> status
sleekdo> tasks
sleekdo> pause
sleekdo> resume
sleekdo> review T004
sleekdo> logs
sleekdo> retry T004
sleekdo> plan
sleekdo> exit
```

That gives you **one consistent interface regardless of whether the underlying worker is Pi, Agy, Claude Code, or another future CLI**.

I would therefore make **“Sleekdo owns the interactive CLI; agent CLIs are headless/controlled backends” a hard architectural requirement in the PRD.**
