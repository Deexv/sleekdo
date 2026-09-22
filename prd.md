\# Sleekdo — Complete Product Requirements Document



\## 1. Product Definition



Sleekdo is an agent orchestration and verification system that enables coding CLI agents to autonomously build, modify, debug, test, refactor, and complete projects of arbitrary size and type.



Sleekdo sits above coding CLI agents such as Pi, Claude Code, Agy, and arbitrary compatible CLI agents.



Sleekdo does not replace the coding agent.



Instead, it controls the development process around the coding agent.



The system consists of three logical AI roles:



\* \*\*A1 — Worker:\*\* executes coding and development work.

\* \*\*A2 — Planner:\*\* understands the user's objective, decomposes it into work, continuously reassesses remaining work, discovers newly required work, and maintains the global development plan.

\* \*\*A3 — Reviewer:\*\* independently verifies A1's work using a fresh session and direct evidence from the project.



The central architectural principle is:



> \*\*A1 performs work, A2 determines what work needs to exist, A3 independently determines whether completed work is actually correct, and the Sleekdo orchestrator is the authority that controls what work may proceed.\*\*



Sleekdo must work for software projects of any category, including but not limited to:



\* applications

\* games

\* websites

\* APIs

\* libraries

\* CLIs

\* operating-system components

\* automation

\* infrastructure

\* data systems

\* AI systems

\* simulations

\* plugins

\* extensions

\* research/code projects

\* migrations

\* refactors

\* bug fixes

\* large multi-system products



The system must not assume that a project has a fixed endpoint known at the beginning.



A2 must be capable of recursively discovering additional required work throughout development.



\---



\# 2. Primary Objective



Given a user request, Sleekdo must be capable of autonomously progressing from:



```text

USER REQUEST

&#x20;   ↓

UNDERSTANDING

&#x20;   ↓

PLAN

&#x20;   ↓

PLAN VERIFICATION

&#x20;   ↓

TASK

&#x20;   ↓

IMPLEMENTATION

&#x20;   ↓

INDEPENDENT REVIEW

&#x20;   ↓

CORRECTION

&#x20;   ↓

REVIEW

&#x20;   ↓

APPROVAL

&#x20;   ↓

REASSESS GLOBAL PROJECT

&#x20;   ↓

NEW TASKS / NEXT TASK

&#x20;   ↓

IMPLEMENTATION

&#x20;   ↓

...

&#x20;   ↓

FINAL SYSTEM VERIFICATION

&#x20;   ↓

COMPLETION

```



The system must continue until the original objective and all subsequently discovered requirements are satisfied, or until it encounters a condition that genuinely requires user input or cannot safely be resolved autonomously.



Completion must never mean merely:



> "The initial TODO list is empty."



Completion means:



> "The system has independently determined that the original user request and all necessary resulting requirements are satisfied, the implementation is integrated, relevant tests and runtime behavior are correct, unnecessary code/files have been identified and removed or justified, and no known blocking work remains."



\---



\# 3. Core Roles



\## 3.1 A1 — Worker



A1 is the coding agent.



A1 should behave like a normal coding CLI agent.



A1 does not need to know that Sleekdo exists.



A1 does not need to know:



\* the complete project plan

\* future tasks

\* A3's identity

\* A3's reasoning

\* the internal Sleekdo state

\* the supervision mechanism

\* other tasks unless relevant to the current task



A1 receives an authorized work item from the orchestrator and executes it using its normal tools.



A1 may:



\* inspect files

\* create files

\* modify files

\* delete files

\* execute commands

\* run tests

\* inspect runtime behavior

\* debug

\* refactor

\* implement features

\* fix bugs

\* perform migrations

\* use project tools



A1 may not:



\* approve its own work

\* advance itself to another task

\* alter task state

\* bypass A3

\* modify Sleekdo state

\* declare another task complete

\* permanently skip work

\* redefine the project requirements



A1's statements about what it accomplished are evidence, not authoritative truth.



\---



\# 4. A2 — Planner



A2 is responsible for understanding and planning the project.



A2 must operate at two levels:



\### Global planning



Understand the entire project and maintain the evolving roadmap.



\### Local planning



Determine exactly what the next work item should accomplish.



A2 must continuously reassess the project rather than assuming the original plan remains complete forever.



\---



\# 5. A3 — Reviewer



A3 is the independent verification agent.



A3 must receive a fresh clean session for each review.



A3 must not rely on conversational memory from previous reviews.



A3 receives the required project information through a generated review context.



A3 must independently inspect the actual implementation.



A3 must not simply accept A1's report.



A3 must determine whether:



\* the task requirements were satisfied

\* acceptance criteria were satisfied

\* the implementation actually exists

\* claimed changes actually occurred

\* tests are meaningful

\* tests pass

\* the implementation integrates correctly

\* scope was respected

\* unnecessary changes were introduced

\* regressions were introduced

\* the implementation creates dead code/files

\* the task is actually complete



A3 may approve, reject, block, or request clarification.



A3 must not reject a task merely because it would personally implement it differently.



\---



\# 6. Orchestrator



The orchestrator is the authority of the system.



Neither A1, A2, nor A3 directly controls task-state transitions.



The orchestrator:



\* receives the user request

\* starts A2 planning

\* manages the plan

\* assigns work to A1

\* monitors A1

\* detects worker-turn completion

\* collects evidence

\* freezes workspaces during review

\* creates A3 review sessions

\* supplies A3 with review context

\* validates A3's structured result

\* updates Sleekdo

\* creates remediation tasks

\* asks A2 to reassess the project

\* determines what task may execute next

\* prevents task skipping

\* handles retries

\* handles escalation

\* handles crashes

\* performs final verification

\* determines project completion



The orchestrator must be the only authority capable of advancing the workflow.



\---



\# 7. Fundamental State Invariant



The system must enforce:



> \*\*No work item may be considered complete or allow dependent work to proceed until it has reached a valid terminal state through the orchestrator.\*\*



A normal task lifecycle is:



```text

PENDING

&#x20; ↓

READY

&#x20; ↓

IN\_PROGRESS

&#x20; ↓

AWAITING\_REVIEW

&#x20; ↓

APPROVED

```



A rejected task follows:



```text

AWAITING\_REVIEW

&#x20; ↓

REJECTED

&#x20; ↓

REMEDIATION\_REQUIRED

&#x20; ↓

SUBTASKS\_CREATED

&#x20; ↓

IN\_PROGRESS

&#x20; ↓

AWAITING\_REVIEW

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

IN\_PROGRESS → NEXT\_TASK

```



without approval or explicitly authorized deferral.



\---



\# 8. Recursive Project Planning



The initial plan must not be treated as the complete project definition.



A2 must continuously reassess the project after meaningful completed work.



Example:



```text

User request

&#x20;   ↓

A2 creates Tasks 1–10

&#x20;   ↓

Tasks 1–4 completed

&#x20;   ↓

A2 reassesses project

&#x20;   ↓

Discovers Tasks 11–15 are required

&#x20;   ↓

Adds them

&#x20;   ↓

Tasks 5–10 continue

&#x20;   ↓

A2 reassesses again

&#x20;   ↓

New integration work discovered

&#x20;   ↓

Adds Tasks 16–19

```



This recursive planning capability is mandatory.



A2 must be able to:



\* create tasks

\* split tasks

\* merge tasks when appropriate

\* create subtasks

\* create remediation tasks

\* create integration tasks

\* create regression tasks

\* create refactoring tasks

\* create testing tasks

\* create cleanup tasks

\* discover missing requirements

\* discover dependencies

\* reprioritize pending work

\* identify obsolete tasks

\* identify tasks that are no longer necessary

\* identify newly exposed work

\* update acceptance criteria when legitimate new information changes the implementation requirements



A2 must never remove required work merely to declare the project complete.



\---



\# 9. Recursive Planning Loop



After meaningful task completion, the orchestrator must invoke A2 for project reassessment.



A2 receives:



\* original user request

\* current project state

\* approved task history

\* outstanding requirements

\* current architecture

\* current implementation state

\* known defects

\* previous review findings

\* current tests

\* current repository state

\* unresolved blockers

\* newly discovered behavior

\* relevant Sleekdo state



A2 must answer:



1\. What requirements remain incomplete?

2\. What newly discovered requirements are necessary to satisfy the original request?

3\. What integration work remains?

4\. What defects remain?

5\. What tests are missing?

6\. What refactoring is required?

7\. What dead code/files exist?

8\. What tasks are obsolete?

9\. What dependencies prevent remaining work?

10\. Is the project actually complete?



A2 must create additional work whenever necessary.



\---



\# 10. Plan Approval



Before A1 begins implementation, A2 must produce an initial plan.



The plan must contain:



\* task IDs

\* objectives

\* requirements

\* acceptance criteria

\* dependencies

\* constraints

\* expected outputs

\* relevant integration considerations



A3 must independently review the initial plan before execution begins.



The plan must not be considered authorized until approved.



If A3 rejects the plan, A2 must revise it.



A3 must reject only concrete planning deficiencies such as:



\* missing explicit requirements

\* impossible ordering

\* missing critical integration work

\* missing acceptance criteria

\* contradictory tasks

\* unnecessary scope

\* inadequate testing strategy

\* clearly missing project-level requirements



\---



\# 11. Task Definition



Every work item must have a stable identity.



Example:



```yaml

id: task\_001

parent\_id: null

type: task



title: Implement authentication



objective: >

&#x20; Implement authentication required by the project.



requirements:

&#x20; - users can authenticate

&#x20; - credentials are validated

&#x20; - invalid credentials are rejected



acceptance\_criteria:

&#x20; - authentication endpoint exists

&#x20; - successful authentication behaves correctly

&#x20; - invalid authentication is rejected

&#x20; - appropriate tests exist

&#x20; - implementation integrates with existing application



dependencies:

&#x20; - task\_000



status: pending

```



Subtasks must preserve parent relationships.



```text

task\_004

&#x20;├── task\_004.1

&#x20;├── task\_004.2

&#x20;└── task\_004.3

```



\---



\# 12. A1 Task Isolation



A1 should normally receive only the current authorized task.



A1 may receive:



\* current objective

\* current acceptance criteria

\* relevant constraints

\* necessary project context

\* relevant existing architectural information

\* remediation requirements if correcting a rejected task



A1 should not receive the entire future roadmap unless required.



This reduces:



\* distraction

\* premature implementation

\* scope expansion

\* accidental task skipping

\* unnecessary context consumption



\---



\# 13. A1 Completion Detection



A1 must not manually control task completion.



The Agent Adapter must detect worker-turn completion.



Completion detection should use the strongest available mechanism.



Priority:



1\. Native agent lifecycle events

2\. Structured agent events

3\. Process state

4\. PTY state

5\. terminal/prompt detection

6\. other reliable harness-specific mechanisms



The system must distinguish:



```text

TURN\_COMPLETE

```



from:



```text

TOOL\_RUNNING

PROCESS\_RUNNING

WAITING\_FOR\_INPUT

COMMAND\_RUNNING

```



A lack of output alone must never be interpreted as task completion.



A1's own statement that it is finished may be recorded as evidence but must not independently trigger approval.



\---



\# 14. Agent Adapter Architecture



Sleekdo must support arbitrary coding CLI agents through an adapter interface.



Conceptual interface:



```typescript

interface AgentAdapter {

&#x20; start(config): Promise<AgentSession>;

&#x20; send(session, input): Promise<void>;

&#x20; interrupt(session): Promise<void>;

&#x20; stop(session): Promise<void>;

&#x20; isAlive(session): Promise<boolean>;

&#x20; events(session): AsyncIterable<AgentEvent>;

&#x20; detectTurnCompletion(session): Promise<boolean>;

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



\---



\# 15. Evidence Collection



A1 output is not sufficient evidence.



The orchestrator must collect objective evidence.



Evidence can include:



\* filesystem snapshots

\* file creation

\* file modification

\* file deletion

\* directory creation/deletion

\* Git status

\* Git diff

\* commit information

\* commands

\* command exit codes

\* command output

\* test results

\* build results

\* runtime output

\* process information

\* generated artifacts

\* dependency changes

\* configuration changes



A3 must be able to inspect actual project state.



\---



\# 16. Before/After Workspace Snapshots



Before assigning a task, the system should capture a workspace baseline.



After A1 stops working, capture the resulting state.



The system must calculate:



\* created files

\* modified files

\* deleted files

\* created directories

\* deleted directories

\* changed dependencies

\* changed configuration

\* relevant Git changes



This evidence becomes part of the A3 review context.



\---



\# 17. Sleekdo Data Architecture



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

&#x20;   state.json

&#x20;   events.jsonl

&#x20;   reviews/

&#x20;   artifacts/

&#x20;   snapshots/

&#x20;   locks/

```



`state.json` contains compact current state.



`events.jsonl` contains append-only history.



Artifacts contain large outputs.



Snapshots contain workspace-state information.



Reviews contain structured A3 results.



\---



\# 18. Sleekdo State



Sleekdo must maintain:



\* original request

\* project identity

\* plan

\* tasks

\* subtasks

\* dependencies

\* current task

\* task statuses

\* acceptance criteria

\* review results

\* remediation requirements

\* blockers

\* deferrals

\* planning revisions

\* project completion state

\* global outstanding requirements

\* cleanup findings

\* final verification state



Approved tasks remain in Sleekdo.



Their temporary execution transcript should be compacted after approval.



\---



\# 19. Event Log



Important events include:



```text

USER\_REQUEST

PLAN\_CREATED

PLAN\_REVISED

PLAN\_APPROVED

PLAN\_REJECTED



TASK\_CREATED

TASK\_STARTED

TASK\_COMPLETION\_CANDIDATE

TASK\_REVIEW\_STARTED

TASK\_APPROVED

TASK\_REJECTED

TASK\_BLOCKED

TASK\_DEFERRED



SUBTASK\_CREATED

SUBTASK\_STARTED

SUBTASK\_APPROVED

SUBTASK\_REJECTED



A1\_MESSAGE

A1\_TOOL\_CALL

A1\_TOOL\_RESULT



FILE\_CREATED

FILE\_MODIFIED

FILE\_DELETED



COMMAND\_STARTED

COMMAND\_FINISHED



TEST\_STARTED

TEST\_FINISHED



A3\_REVIEW\_STARTED

A3\_APPROVED

A3\_REJECTED



PROJECT\_REASSESSMENT

PROJECT\_COMPLETION\_CHECK

PROJECT\_APPROVED

PROJECT\_BLOCKED

```



\---



\# 20. A3 Review Context



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



\---



\# 21. A3 Fresh Session Requirement



Each task or subtask review must use a clean A3 session.



After the review decision:



\* persist the structured result

\* persist evidence references

\* destroy the A3 session/context



The next review must not inherit conversational memory from the previous review.



Only persistent project state and evidence may carry forward.



\---



\# 22. A3 Review Policy



A3 must verify:



\### Requirement compliance



Does the implementation satisfy the explicit requirement?



\### Acceptance criteria



Are all criteria satisfied?



\### Actual implementation



Does the claimed implementation actually exist?



\### Runtime behavior



Does the implementation behave correctly?



\### Testing



Are appropriate tests present and passing?



\### Regression



Did the change break existing behavior?



\### Integration



Does the implementation work with the rest of the project?



\### Scope



Did the worker introduce unnecessary functionality?



\### Architecture



Does the implementation fit the existing system?



\### Cleanup



Did the implementation create dead code, dead files, unused dependencies, obsolete paths, or redundant functionality?



\### Completeness



Was anything required by the task forgotten?



A3 must approve valid implementations even when another implementation style might also be possible.



\---



\# 23. A3 Decisions



A3 must return structured decisions:



```text

APPROVE

REJECT

BLOCK

```



\### APPROVE



The task satisfies its requirements.



\### REJECT



There is a concrete issue requiring correction.



\### BLOCK



The task cannot safely proceed because of an external or unresolved dependency.



A3 must provide concrete evidence for rejection.



\---



\# 24. Rejection Requirements



A rejection must include:



\* problem

\* evidence

\* affected requirement

\* required correction

\* acceptance condition for the correction



Example:



```json

{

&#x20; "decision": "reject",

&#x20; "blocking\_issues": \[

&#x20;   {

&#x20;     "description": "Expired tokens are accepted.",

&#x20;     "evidence": "src/auth/token.ts:51",

&#x20;     "required\_fix": "Reject expired tokens.",

&#x20;     "verification": "Add and pass an expired-token regression test."

&#x20;   }

&#x20; ]

}

```



A vague rejection such as:



> "The implementation isn't good."



is invalid.



\---



\# 25. Preventing Endless Review Loops



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



\* A2 reassessment

\* expanded diagnostics

\* alternative implementation strategy

\* user clarification

\* manual intervention



\---



\# 26. Evidence-Driven Debugging System



Sleekdo must impose a disciplined debugging methodology on A1 and A2.



When a defect is discovered, agents must not immediately begin changing code based on an unverified hypothesis.



The required debugging principle is:



> \*\*Determine the actual failure mechanism before designing the fix.\*\*



\---



\# 27. Binary-Search Debugging



When the cause of a problem is unclear, the agent should:



1\. Define the observed failure.

2\. Establish the expected behavior.

3\. Identify candidate causal mechanisms.

4\. Partition the remaining hypothesis space.

5\. Choose the diagnostic step that eliminates the largest amount of uncertainty.

6\. Obtain evidence.

7\. Eliminate hypotheses inconsistent with the evidence.

8\. Repeat until one plausible mechanism survives.

9\. Confirm the surviving mechanism with runtime or direct implementation evidence.

10\. Only then design the fix.



Conceptually:



```text

Observed failure

&#x20;      ↓

Candidate causes

&#x20;┌─────┼─────┐

&#x20;A     B     C

&#x20;      ↓

Diagnostic evidence

&#x20;      ↓

Eliminate impossible causes

&#x20;      ↓

Remaining causes

&#x20;   ┌────┴────┐

&#x20;   D         E

&#x20;   ↓

More evidence

&#x20;   ↓

Surviving mechanism

&#x20;   ↓

Confirm mechanism

&#x20;   ↓

Design fix

```



The goal is to minimize wasted implementation.



\---



\# 28. Maximum-Information Diagnostics



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



\---



\# 29. Runtime Evidence



When program state is unclear, the agent must be allowed and encouraged to add temporary instrumentation.



Examples:



\* logging

\* assertions

\* tracing

\* state dumps

\* request/response capture

\* timing information

\* subsystem boundary instrumentation

\* debug counters

\* temporary diagnostic scripts



The agent must run the program and inspect the resulting evidence.



Instrumentation that is no longer needed must be removed unless it is intentionally part of the final system.



\---



\# 30. No Guess-Driven Debugging



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



\* test a hypothesis

\* eliminate a hypothesis

\* confirm a mechanism

\* expose new evidence



If an attempt produces no useful information, the next step should change the diagnostic strategy.



\---



\# 31. Mechanism Confirmation Before Fix



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



\* runtime evidence

\* tests

\* tracing

\* direct source analysis

\* reproducible behavior

\* controlled experiments

\* subsystem isolation



A plausible but unconfirmed cause must not be treated as fact.



\---



\# 32. Debugging State



Sleekdo should track debugging investigations.



Example:



```yaml

investigation:

&#x20; id: investigation\_12

&#x20; task\_id: task\_031



&#x20; observed\_failure:

&#x20;   expected: "request succeeds"

&#x20;   actual: "request returns 500"



&#x20; hypotheses:

&#x20;   - id: H1

&#x20;     description: "database connection failure"

&#x20;     status: eliminated

&#x20;     evidence: "database query succeeds"



&#x20;   - id: H2

&#x20;     description: "serialization failure"

&#x20;     status: surviving



&#x20;   - id: H3

&#x20;     description: "authentication middleware failure"

&#x20;     status: eliminated



&#x20; confirmed\_mechanism:

&#x20;   description: "response serializer receives invalid object shape"

&#x20;   evidence:

&#x20;     - runtime\_trace\_22

&#x20;     - test\_case\_31



&#x20; fix:

&#x20;   status: planned

```



This makes debugging auditable and prevents circular reasoning.



\---



\# 33. Fix Isolation



When fixing a confirmed defect, the agent should modify the smallest reasonable set of components necessary to correct the actual mechanism.



A1 must avoid unrelated modifications.



A3 must inspect whether the fix changed unrelated areas.



If unrelated changes are found, A3 may require them to be reverted unless justified.



\---



\# 34. Recurring Dead-Code Analysis



Dead-code and dead-file analysis is a mandatory recurring verification activity.



It must not happen only at the end.



Large projects accumulate:



\* unused files

\* obsolete modules

\* abandoned implementations

\* unused functions

\* unused classes

\* unreachable branches

\* stale configuration

\* unused dependencies

\* duplicate functionality

\* obsolete tests

\* temporary debugging code

\* generated artifacts that should not exist

\* old migration paths

\* abandoned experiments



Sleekdo must actively detect these.



\---



\# 35. Dead-Code Verification Triggers



Dead-code analysis must occur:



\* after significant architectural changes

\* after major feature completion

\* after refactoring

\* after removing functionality

\* after resolving large bugs

\* during project reassessment

\* before major final verification

\* during final verification



The orchestrator should also schedule cleanup when evidence indicates likely dead code.



\---



\# 36. Dead-Code Analysis



A2 should identify candidates using:



\* static analysis

\* language tooling

\* compiler warnings

\* unused symbol detection

\* import graph analysis

\* dependency analysis

\* reference search

\* route analysis

\* build graph analysis

\* test coverage information

\* runtime traces

\* package dependency analysis

\* configuration references

\* generated-file analysis



A3 independently verifies cleanup decisions where appropriate.



\---



\# 37. Dead-Code Must Not Be Removed Blindly



A candidate is not automatically dead merely because static analysis cannot find a reference.



Potentially dynamic systems may use:



\* reflection

\* dynamic imports

\* plugin discovery

\* configuration-based loading

\* dependency injection

\* route registration

\* event registration

\* external consumers

\* generated references

\* runtime discovery



Therefore the system must classify candidates:



```text

CONFIRMED DEAD

PROBABLY DEAD

DYNAMICALLY REFERENCED

UNKNOWN

REQUIRED

```



Only sufficiently verified dead code should be automatically removed.



\---



\# 38. Dead-File Analysis



The same process applies to files.



For each candidate:



```text

file

&#x20;↓

reference analysis

&#x20;↓

import/dependency analysis

&#x20;↓

configuration analysis

&#x20;↓

runtime relevance

&#x20;↓

build relevance

&#x20;↓

external/API relevance

&#x20;↓

classification

```



A3 must verify cleanup where the consequences could be significant.



\---



\# 39. Cleanup Tasks



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



\---



\# 40. Final Dead-Code Sweep



Before final project completion:



A2 must perform a project-wide cleanup analysis.



It must identify:



\* dead files

\* dead functions

\* dead classes

\* unused imports

\* unused dependencies

\* obsolete configurations

\* obsolete tests

\* duplicated implementations

\* temporary diagnostics

\* abandoned migration code

\* stale documentation where applicable

\* generated artifacts that should not remain



Any confirmed unnecessary material must either:



1\. be removed, or

2\. have a documented justification for remaining.



A3 must independently review the final cleanup result.



\---



\# 41. Global Reassessment



After approved work, A2 must periodically perform a complete project reassessment.



This is not merely:



> "What's the next task?"



It is:



> "Given everything now known, what is required for the entire user objective to be genuinely complete?"



A2 must compare:



```text

Original request

\+

current implementation

\+

approved work

\+

known defects

\+

newly discovered requirements

\+

integration state

\+

tests

\+

runtime behavior

\+

cleanup state

```



against the desired final state.



\---



\# 42. Newly Discovered Requirements



If implementing one feature exposes another necessary requirement, A2 must create it.



Example:



```text

User requests:

"Add multiplayer."



A2 initially plans:

\- networking

\- player synchronization

\- session management



Implementation reveals:

\- state persistence is required for reconnect

\- authority validation is required

\- disconnect recovery is required



A2 must create those tasks.

```



The project must not be declared complete simply because those tasks were absent from the original plan.



\---



\# 43. No Premature Completion



The system must not declare completion because:



\* the initial task list is empty

\* all originally planned tasks passed

\* A1 says it is finished

\* tests happen to pass

\* the build succeeds

\* the project compiles

\* A3 approved the previous task



Completion requires global verification.



\---



\# 44. Final Completion Verification



A final clean A3 session must evaluate:



\### Original request



Does the implementation satisfy the user's actual request?



\### Requirements



Are all explicit requirements fulfilled?



\### Discovered requirements



Were all necessary requirements discovered during implementation fulfilled?



\### Integration



Do all major systems work together?



\### Runtime



Does the system behave correctly in realistic execution?



\### Tests



Are appropriate tests passing?



\### Regression



Did the final implementation preserve existing required functionality?



\### Scope



Was unnecessary functionality avoided?



\### Cleanup



Are dead files/code/dependencies removed or justified?



\### Architecture



Is the resulting implementation internally coherent?



\### Operational state



Can the project actually be built/run/used as required?



Only then can the orchestrator declare:



```text

PROJECT\_COMPLETE

```



\---



\# 45. Completion Must Be Evidence-Based



The final decision must include evidence.



Example:



```yaml

completion:

&#x20; status: complete



&#x20; requirements:

&#x20;   total: 47

&#x20;   satisfied: 47



&#x20; tests:

&#x20;   passed: 318

&#x20;   failed: 0



&#x20; build:

&#x20;   status: passed



&#x20; runtime:

&#x20;   status: verified



&#x20; cleanup:

&#x20;   dead\_code\_candidates: 31

&#x20;   confirmed\_removed: 27

&#x20;   retained\_with\_justification: 4



&#x20; final\_review:

&#x20;   reviewer: A3

&#x20;   decision: approved

```



\---



\# 46. User Clarification



The system should ask the user only when autonomous resolution is genuinely impossible or when the user's intent is materially ambiguous.



Examples:



\* two requirements directly contradict each other

\* required external information is unavailable

\* a destructive decision requires user authorization

\* an external service/account is required and inaccessible

\* multiple interpretations produce materially different products

\* the user must provide a required asset or credential



The system should not ask the user for ordinary engineering decisions that A2/A1 can reasonably resolve.



\---



\# 47. Permission and Safety Boundaries



Sleekdo must distinguish between:



```text

authorized project operations

```



and:



```text

operations requiring explicit user approval

```



The system must allow configurable policies for:



\* filesystem access

\* network access

\* package installation

\* shell commands

\* external services

\* destructive operations

\* secrets

\* deployment

\* production environments



A3 cannot authorize an operation that the system policy prohibits.



\---



\# 48. Workspace Isolation



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



\---



\# 49. Review-Time Workspace Freeze



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



\---



\# 50. Review Identity



Each review must record:



```yaml

review:

&#x20; id: review\_019

&#x20; task\_id: task\_019

&#x20; sleekdo\_revision: 412

&#x20; workspace\_snapshot: sha256:...

&#x20; reviewer\_provider: ...

&#x20; reviewer\_model: ...

&#x20; started\_at: ...

&#x20; completed\_at: ...

```



This establishes exactly what A3 reviewed.



\---



\# 51. State Revisioning



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



\---



\# 52. Crash Recovery



Sleekdo must survive:



\* A1 crashes

\* A2 crashes

\* A3 crashes

\* CLI crashes

\* machine restart

\* network failure

\* provider failure

\* command timeout

\* process termination

\* corrupted temporary session



Persistent state must allow the orchestrator to determine:



\* what task was active

\* whether A1 was running

\* whether A1 had stopped

\* whether review had begun

\* whether review completed

\* what evidence existed

\* whether the workspace changed



The system must never assume completion after an ambiguous crash.



\---



\# 53. Idempotency



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



\---



\# 54. Parallelism



The initial control model is sequential per workspace:



```text

A1

&#x20;↓

A3

&#x20;↓

A1

&#x20;↓

A3

```



However, the architecture must support future parallel work where tasks are demonstrably independent.



Parallel work must require:



\* dependency analysis

\* isolated workspaces or branches

\* independent review

\* merge/integration review

\* conflict resolution

\* final system verification



Parallelism must never weaken task authorization or verification.



\---



\# 55. Git Integration



When Git is present, Sleekdo should integrate with it.



Useful information includes:



\* branch

\* commit

\* status

\* diff

\* changed files

\* history

\* merge state



Sleekdo must not require Git for basic operation.



Filesystem-based evidence must remain available.



\---



\# 56. Testing Strategy



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



\---



\# 57. Test Gap Detection



A3 should identify situations where:



```text

implementation exists

but

critical behavior has no meaningful verification

```



A3 can reject a task when a missing test represents a material requirement.



A2 should then create testing work.



\---



\# 58. Regression Protection



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



\---



\# 59. Refactoring



Refactoring must be treated as controlled work.



A1 should not perform broad unrelated refactoring while implementing a task.



If a refactor is necessary:



```text

A2 creates/refines task

→ A1 performs refactor

→ A3 verifies behavior preservation

```



Large refactors must include regression verification.



\---



\# 60. Scope Control



Every task must define what is inside and outside its scope when useful.



A3 should flag:



\* unrelated features

\* unnecessary dependencies

\* unrelated architecture changes

\* unnecessary rewrites

\* unrelated file modifications



A2 may determine that a broader change is necessary, in which case it must explicitly create or expand the relevant task rather than allowing A1 to silently expand scope.



\---



\# 61. Temporary Artifacts



A1 may create temporary:



\* logs

\* scripts

\* diagnostic files

\* debug instrumentation

\* generated output



These must be classified.



Before task approval:



```text

temporary and unnecessary → remove

temporary but useful → justify

required final artifact → retain

```



The final cleanup sweep must detect leftovers.



\---



\# 62. A2 Planning Rules



A2 should:



\* prefer the smallest coherent task

\* preserve dependencies

\* avoid unnecessary decomposition

\* avoid enormous tasks that cannot be independently verified

\* avoid excessive microtasks

\* include acceptance criteria

\* account for integration

\* account for testing

\* account for cleanup

\* revisit assumptions when evidence changes

\* create new work when implementation reveals it

\* remove obsolete work when legitimately no longer required



A2 must optimize for successful completion, not maximum task count.



\---



\# 63. A3 Review Rules



A3 should:



\* trust evidence over claims

\* inspect actual implementation

\* verify requirements

\* verify acceptance criteria

\* verify runtime behavior where appropriate

\* identify regressions

\* identify scope expansion

\* identify dead code/files

\* identify incomplete work

\* distinguish defects from preferences

\* avoid unnecessary rejection

\* provide actionable remediation

\* confirm fixes using evidence



A3 must not invent requirements that do not arise from the user's request, necessary system behavior, or explicitly established project constraints.



\---



\# 64. A1 Execution Rules



A1 should:



\* work only on the authorized task

\* inspect existing code before modifying it

\* preserve existing functionality

\* use appropriate tests

\* diagnose failures using evidence

\* confirm mechanisms before major fixes

\* avoid unrelated modifications

\* clean temporary debugging changes

\* report what it believes it accomplished



A1's report remains non-authoritative.



\---



\# 65. Agent Prompt Separation



Prompts should be separated by role.



```text

prompts/

&#x20;   a1-worker.md

&#x20;   a2-planner.md

&#x20;   a3-reviewer.md

```



The prompts must not contain unnecessary role leakage.



A1 should not be told about A3.



A3 should not rely on A1's internal reasoning.



A2 should reason about project-level planning rather than directly performing every implementation step.



\---



\# 66. A1 Prompt Contract



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



\---



\# 67. A2 Prompt Contract



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



\---



\# 68. A3 Prompt Contract



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



\---



\# 69. Global Project State



The project should maintain:



```yaml

project:

&#x20; status:

&#x20;   planning

&#x20;   executing

&#x20;   reviewing

&#x20;   blocked

&#x20;   final\_verification

&#x20;   complete



&#x20; requirements:

&#x20; tasks:

&#x20; discoveries:

&#x20; defects:

&#x20; cleanup:

&#x20; tests:

&#x20; architecture:

&#x20; completion:

```



\---



\# 70. Requirement Traceability



Every important requirement should be traceable.



```text

User requirement

&#x20;   ↓

A2 plan

&#x20;   ↓

Task

&#x20;   ↓

Acceptance criteria

&#x20;   ↓

Implementation

&#x20;   ↓

Tests/evidence

&#x20;   ↓

A3 approval

```



This prevents requirements from silently disappearing during a long project.



\---



\# 71. Requirement Coverage



Sleekdo should maintain a requirement matrix.



Example:



```yaml

requirement\_001:

&#x20; description: "Users can authenticate."

&#x20; tasks:

&#x20;   - task\_012

&#x20;   - task\_013

&#x20; tests:

&#x20;   - test\_auth\_01

&#x20;   - test\_auth\_02

&#x20; status: satisfied

```



The final completion check must ensure no required item is orphaned.



\---



\# 72. Discovery Traceability



New requirements discovered during implementation must also be traceable.



```text

Original requirement

&#x20;   ↓

Implementation discovery

&#x20;   ↓

New necessary requirement

&#x20;   ↓

A2 task

&#x20;   ↓

A1 implementation

&#x20;   ↓

A3 verification

```



This is what allows Sleekdo to grow a project intelligently instead of blindly following the initial TODO.



\---



\# 73. Completion as a Fixed-Point Process



The project should be considered complete only when repeated global reassessment produces no additional required work.



Conceptually:



```text

Current project

&#x20;     ↓

A2 reassessment

&#x20;     ↓

Required work?

&#x20;  ┌──┴──┐

&#x20; YES    NO

&#x20;  │      │

&#x20;  ▼      ▼

create   final

tasks    verification

&#x20;  │

&#x20;  ▼

execute

&#x20;  │

&#x20;  ▼

review

&#x20;  │

&#x20;  └───────────────→ reassess again

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



\---



\# 74. Final Verification Must Be Fresh



The final A3 review must use a fresh session.



It must not rely on the accumulated conversational history of previous A3 sessions.



It must independently inspect the final project.



This prevents:



```text

"We approved all previous tasks, therefore the final project must be correct."

```



from becoming an assumption.



\---



\# 75. Observability



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



\---



\# 76. Progress Must Not Be Measured Only by Task Count



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



\* requirements satisfied

\* blocking work

\* active task

\* outstanding requirements

\* verification status

\* known defects



rather than misleading task-count percentages.



\---



\# 77. Human Override



The user should be able to:



\* pause

\* resume

\* cancel

\* inspect

\* provide clarification

\* approve exceptional decisions

\* authorize restricted operations

\* modify requirements

\* request replanning



A human override must be recorded in Sleekdo.



The system must distinguish user decisions from AI decisions.



\---



\# 78. Requirement Changes



If the user changes the request during development:



```text

new user input

&#x20;   ↓

A2 reassessment

&#x20;   ↓

impact analysis

&#x20;   ↓

update requirements

&#x20;   ↓

update tasks

&#x20;   ↓

A3 verifies revised plan

&#x20;   ↓

continue

```



The system must not blindly continue executing an obsolete plan.



\---



\# 79. Plan Versioning



Plans must be versioned.



```text

Plan v1

Plan v2

Plan v3

...

```



Each version records:



\* changes

\* reason

\* affected requirements

\* affected tasks

\* approval state



\---



\# 80. Architecture Consistency



A2 must periodically examine whether accumulated implementation has caused architectural drift.



It should identify:



\* duplicated systems

\* conflicting abstractions

\* unnecessary dependencies

\* inconsistent patterns

\* accidental coupling

\* obsolete interfaces

\* parallel implementations of the same responsibility



If architectural cleanup is necessary, A2 creates explicit work.



A3 verifies it.



\---



\# 81. Dependency Hygiene



The system must periodically analyze dependencies.



Identify:



\* unused packages

\* duplicate packages

\* unnecessary packages

\* incompatible versions

\* transitive risks where relevant

\* packages replaced by project-native functionality



A2 creates cleanup work where justified.



A3 verifies that removing dependencies does not break the system.



\---



\# 82. Documentation and Project Knowledge



Documentation should be treated as implementation only when required by the project.



A2 should create documentation tasks when documentation is necessary for:



\* user operation

\* API usage

\* deployment

\* maintenance

\* architecture

\* generated interfaces

\* project handoff



A3 verifies important documentation claims against the actual implementation.



\---



\# 83. Artifact and Context Management



Large outputs must not be injected into every model context.



Use references:



```text

artifact\_id

file\_id

snapshot\_id

command\_id

test\_id

review\_id

```



A2/A3 can retrieve details when required.



This allows projects to become very large without making every AI context enormous.



\---



\# 84. Security of Review Context



A3 must not receive secrets unnecessarily.



The review-context builder should redact:



\* credentials

\* API keys

\* private keys

\* authentication tokens

\* sensitive environment variables



unless the review genuinely requires them and policy explicitly permits access.



\---



\# 85. Provider Independence



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



\---



\# 86. Model Independence



The system must not assume that A1, A2, and A3 are equally capable.



Role-specific prompts and validation should compensate for differences.



Structured outputs must be schema-validated.



The orchestrator must reject malformed AI decisions.



\---



\# 87. AI Output Validation



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



\---



\# 88. No Hidden State Transitions



Every important transition must be represented explicitly.



For example:



```text

TASK\_APPROVED

```



must be an event.



The system must not silently mutate:



```text

task.status = approved

```



without recording why.



\---



\# 89. Auditability



For every completed task, the system should be able to answer:



\* What requirement caused this task to exist?

\* What did A1 receive?

\* What did A1 change?

\* What commands were executed?

\* What tests were run?

\* What did A1 claim?

\* What did A3 inspect?

\* What evidence did A3 use?

\* Why was it approved?

\* If rejected, why?

\* What remediation occurred?

\* What final state was approved?



\---



\# 90. Core Safety Principle



A1, A2, and A3 are all fallible.



Therefore:



```text

AI statement

&#x20;   ≠

system fact

```



System facts should come from:



\* filesystem state

\* process state

\* command results

\* test results

\* source inspection

\* runtime evidence

\* structured persisted state



AI reasoning interprets evidence; it does not create reality.



\---



\# 91. Minimum Required Components



The implementation must contain:



```text

1\. Orchestrator

2\. Sleekdo state store

3\. Event store

4\. Task state machine

5\. Recursive planner

6\. A1 agent adapter

7\. A2 planner runner

8\. A3 reviewer runner

9\. Review-context builder

10\. Filesystem evidence engine

11\. Git evidence engine

12\. Command evidence engine

13\. Test evidence engine

14\. Workspace snapshot system

15\. Workspace locking

16\. Crash recovery

17\. Schema validation

18\. Requirement traceability

19\. Debugging/investigation system

20\. Dead-code analysis

21\. Dead-file analysis

22\. Cleanup task generation

23\. Final verification

24\. CLI interface

25\. Configuration system

```



\---



\# 92. Core End-to-End Algorithm



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

&#x20;   A2 revises plan

&#x20;   A3 reviews again



↓



If approved:



&#x20;   while project is not complete:



&#x20;       A2 reassesses current project state



&#x20;       discover:

&#x20;           missing requirements

&#x20;           new tasks

&#x20;           dependencies

&#x20;           defects

&#x20;           integration work

&#x20;           testing work

&#x20;           cleanup work



&#x20;       select next authorized READY work item



&#x20;       capture workspace baseline



&#x20;       start A1



&#x20;       send only authorized work item



&#x20;       monitor A1



&#x20;       collect:

&#x20;           messages

&#x20;           tool calls

&#x20;           commands

&#x20;           files

&#x20;           changes

&#x20;           tests

&#x20;           runtime evidence



&#x20;       detect worker turn completion



&#x20;       freeze workspace



&#x20;       capture final workspace state



&#x20;       create fresh A3 session



&#x20;       construct review context



&#x20;       A3 independently verifies task



&#x20;       if APPROVED:

&#x20;           persist approval

&#x20;           compact temporary task transcript

&#x20;           destroy A3 session

&#x20;           unlock workspace

&#x20;           continue



&#x20;       if REJECTED:

&#x20;           persist findings

&#x20;           create remediation work

&#x20;           destroy A3 session

&#x20;           unlock workspace

&#x20;           send remediation to A1

&#x20;           continue



&#x20;       if BLOCKED:

&#x20;           persist blocker

&#x20;           invoke A2

&#x20;           resolve, defer, or request user input



&#x20;       periodically:

&#x20;           perform dead-code analysis

&#x20;           perform dead-file analysis

&#x20;           perform dependency analysis

&#x20;           perform architecture reassessment

&#x20;           perform requirement reassessment



↓



When A2 determines no required work remains:



&#x20;   run final cleanup analysis



&#x20;   perform required cleanup



&#x20;   run full relevant test/build/runtime verification



&#x20;   start fresh A3 final review



&#x20;   A3 verifies:

&#x20;       original request

&#x20;       all requirements

&#x20;       integration

&#x20;       runtime

&#x20;       tests

&#x20;       regressions

&#x20;       cleanup

&#x20;       architecture

&#x20;       completeness



&#x20;   if approved:

&#x20;       PROJECT\_COMPLETE



&#x20;   otherwise:

&#x20;       return to A2

&#x20;       create additional work

&#x20;       continue loop

```



\---



\# 93. The Most Important Architectural Rule



The system must not be:



```text

Planner → TODO → Worker → Reviewer → Done

```



It must be:



```text

Planner

&#x20;  ↓

Work

&#x20;  ↓

Independent Verification

&#x20;  ↓

Global Reassessment

&#x20;  ↓

Discover More Work

&#x20;  ↓

Work

&#x20;  ↓

Independent Verification

&#x20;  ↓

Global Reassessment

&#x20;  ↓

...

&#x20;  ↓

Final Verification

&#x20;  ↓

Done

```



That distinction is what makes Sleekdo capable of handling projects whose true scope cannot be known completely at the beginning.



\---



\# 94. Definition of "Complete"



Sleekdo must only declare a project complete when all of the following are true:



```text

\[✓] Original user requirements satisfied

\[✓] Necessary discovered requirements satisfied

\[✓] All required work items approved

\[✓] No unresolved blocking defects

\[✓] Required tests pass

\[✓] Relevant runtime behavior verified

\[✓] Integration verified

\[✓] Regression checks completed

\[✓] Dead-code analysis completed

\[✓] Dead-file analysis completed

\[✓] Unnecessary dependencies addressed

\[✓] Temporary diagnostics cleaned

\[✓] Scope is controlled

\[✓] Architecture is coherent enough for the project's requirements

\[✓] Final A3 review approved

```



Only the orchestrator may transition the project to:



```text

COMPLETE

```



\---



\# 95. Product Philosophy



Sleekdo should optimize for:



```text

correctness

\+

evidence

\+

completeness

\+

controlled scope

\+

continuous planning

\+

independent verification

\+

efficient debugging

\+

clean implementation

```



rather than simply maximizing:



```text

lines of code

tasks completed

agent activity

```



The system's objective is not to make A1 work continuously.



The objective is to make the \*\*correct project actually exist\*\*.



\---



\# 96. Final Architecture



The final conceptual architecture is:



```text

&#x20;                        USER

&#x20;                          │

&#x20;                          ▼

&#x20;                 ┌─────────────────┐

&#x20;                 │   ORCHESTRATOR  │

&#x20;                 └────────┬────────┘

&#x20;                          │

&#x20;                          ▼

&#x20;                 ┌─────────────────┐

&#x20;                 │      A2         │

&#x20;                 │ GLOBAL PLANNER  │

&#x20;                 │                 │

&#x20;                 │ plan            │

&#x20;                 │ decompose       │

&#x20;                 │ reassess        │

&#x20;                 │ discover        │

&#x20;                 │ reprioritize    │

&#x20;                 └────────┬────────┘

&#x20;                          │

&#x20;                          ▼

&#x20;                 ┌─────────────────┐

&#x20;                 │     SLEEKDO     │

&#x20;                 │                 │

&#x20;                 │ state           │

&#x20;                 │ requirements    │

&#x20;                 │ tasks           │

&#x20;                 │ dependencies    │

&#x20;                 │ evidence        │

&#x20;                 │ reviews         │

&#x20;                 │ investigations  │

&#x20;                 │ cleanup         │

&#x20;                 └───────┬─────────┘

&#x20;                         │

&#x20;                   authorized work

&#x20;                         │

&#x20;                         ▼

&#x20;                 ┌─────────────────┐

&#x20;                 │      A1         │

&#x20;                 │     WORKER      │

&#x20;                 │                 │

&#x20;                 │ code            │

&#x20;                 │ test            │

&#x20;                 │ debug           │

&#x20;                 │ execute        │

&#x20;                 └────────┬────────┘

&#x20;                          │

&#x20;                          ▼

&#x20;                 ┌─────────────────┐

&#x20;                 │    EVIDENCE     │

&#x20;                 │                 │

&#x20;                 │ filesystem      │

&#x20;                 │ git             │

&#x20;                 │ commands        │

&#x20;                 │ tests           │

&#x20;                 │ runtime         │

&#x20;                 └────────┬────────┘

&#x20;                          │

&#x20;                          ▼

&#x20;                 ┌─────────────────┐

&#x20;                 │      A3         │

&#x20;                 │    REVIEWER     │

&#x20;                 │                 │

&#x20;                 │ fresh session   │

&#x20;                 │ inspect         │

&#x20;                 │ verify          │

&#x20;                 │ approve/reject  │

&#x20;                 └────────┬────────┘

&#x20;                          │

&#x20;                          ▼

&#x20;                 ┌─────────────────┐

&#x20;                 │   ORCHESTRATOR  │

&#x20;                 │                 │

&#x20;                 │ approve         │

&#x20;                 │ remediate       │

&#x20;                 │ replan          │

&#x20;                 │ continue        │

&#x20;                 └────────┬────────┘

&#x20;                          │

&#x20;                          └───────────────┐

&#x20;                                          │

&#x20;                                          ▼

&#x20;                                  GLOBAL REASSESSMENT

&#x20;                                          │

&#x20;                                          ▼

&#x20;                                 MORE WORK OR COMPLETE

```



\## Final governing principle



\*\*A1 should never be trusted to decide what the project needs next, A2 should never be trusted to declare its own plan correct, A3 should never be trusted merely because it is a reviewer, and no AI should be trusted merely because it claims something happened; Sleekdo must continuously turn requirements into authorized work, work into observable evidence, evidence into independently verified results, and verified results back into global planning until the entire system reaches a demonstrably complete state.\*\*



