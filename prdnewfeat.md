# Sleekdo — Oh My Pi Feature Integration & Native Harness Architecture Plan

## 0. Mission

Extend the existing Sleekdo codebase into a polished, provider-independent coding-agent environment by integrating the proven developer-tooling methods, interaction patterns, architecture, and implementation ideas used by the current **Oh My Pi** project, while preserving Sleekdo's own orchestration model:

* A1 = Worker
* A2 = Planner/Orchestrator
* A3 = Independent Reviewer
* Sleekdo = authoritative state machine and user-facing environment
* Connected CLIs = execution/model/harness providers

The goal is **not** to build approximate versions of these features from memory.

The implementation agent MUST inspect the current Oh My Pi source tree, documentation, configuration, prompts, tests, and relevant implementation files before implementing each major feature. Use Oh My Pi's current, battle-tested implementation as the technical reference and adapt the underlying methods to Sleekdo's architecture.

Oh My Pi currently describes itself as a coding agent with the IDE wired in and exposes a large integrated tool surface, including LSP, DAP debugging, hashline editing, subagents, persistent processes, browser/computer tooling, and other developer capabilities.

Do not blindly copy architecture that conflicts with Sleekdo's orchestration model. Preserve the proven implementation techniques while integrating them cleanly into Sleekdo.

---

# 1. First Step: Repository and Architecture Audit

Before modifying Sleekdo, inspect the entire current Sleekdo repository.

Determine:

* current application entry points
* CLI implementation
* TUI implementation
* input handling
* terminal rendering
* provider adapters
* Pi integration
* A1/A2/A3 implementation
* task state machine
* persistence
* event system
* workspace management
* process management
* tests
* build system
* installer/release system
* configuration
* current command parser
* current session architecture

Then inspect the current Oh My Pi repository directly.

Do not rely on summaries, old documentation, cached knowledge, or assumptions.

Use the current upstream source as the reference:

* repository architecture
* tool implementations
* TUI implementation
* command handling
* LSP subsystem
* DAP subsystem
* Hashline subsystem
* tool schemas
* model-facing prompts
* settings/configuration
* session/artifact handling
* process management
* tests
* error handling
* recovery behavior
* terminal behavior

Create an internal implementation mapping:

```text
Oh My Pi subsystem
        ↓
Current source/design
        ↓
Proven method
        ↓
Sleekdo equivalent
        ↓
Sleekdo-specific integration
        ↓
Tests
```

Do this before implementing each major subsystem.

---

# 2. Licensing and Attribution Audit

Before copying or adapting code, inspect the current Oh My Pi LICENSE and relevant source headers.

Determine exactly what can be:

* reused
* adapted
* copied
* rewritten
* attributed

Preserve required copyright/license notices and create/update third-party attribution documentation where required.

Do not remove upstream attribution from reused code.

Do not claim upstream implementation as original Sleekdo work.

If a component is better reimplemented than copied, preserve the proven algorithm/design while writing a Sleekdo-native implementation.

---

# 3. Core Command Architecture

Sleekdo must have exactly two command namespaces.

## Sleekdo commands

Anything beginning with:

```text
//
```

belongs to Sleekdo.

Examples:

```text
//help
//status
//tasks
//plan
//review T004
//pause
//resume
//retry T004
//logs
//provider
//session
//verify
//cleanup
//exit
```

## Connected CLI commands

Everything else belongs to the currently connected CLI harness.

This includes:

```text
/...
```

and ordinary agent input.

Therefore:

```text
//command
```

→ Sleekdo

while:

```text
/command
```

→ connected CLI

and:

```text
Build the authentication system.
```

→ connected CLI

This distinction is fundamental.

---

# 4. Connected CLI Commands Must NOT Be Hard-Coded

This is a strict requirement.

Do NOT create an allowlist such as:

```text
/model
/settings
/tools
/help
```

Do NOT implement individual provider commands inside Sleekdo merely to support known commands.

The connected provider owns its native command language.

Sleekdo must forward provider-native input without requiring Sleekdo to know every command.

Therefore, if Pi adds:

```text
/new-command
```

Sleekdo should not need a new release merely for `/new-command` to become routable.

Likewise for Agy, Claude Code, or any future connected harness.

The provider receives the original command and handles it.

---

# 5. Native Provider Behavior Must Be Preserved

When a user enters a provider command through Sleekdo, it should behave as it behaves when entered directly into that provider's own CLI.

Preserve:

* syntax
* arguments
* flags
* interactive prompts
* menus
* confirmations
* model changes
* settings
* tool settings
* session commands
* authentication
* provider-specific state
* output
* errors
* cancellation
* interrupts
* terminal behavior

Do not translate provider commands into Sleekdo equivalents.

Do not emulate them.

Do not restrict them.

Sleekdo is the host interface; the connected CLI remains the authority for its own command semantics.

---

# 6. Input Router

Implement a minimal deterministic routing rule:

```text
if input starts with "//":
    Sleekdo command
else:
    connected CLI input
```

Do not add heuristic routing.

Do not inspect whether `/foo` happens to be known.

Do not maintain provider-specific command lists.

Do not reinterpret ordinary provider input.

This guarantees compatibility with future provider functionality.

---

# 7. Provider Process Architecture

The connected CLI must run as a real long-lived interactive process.

The adapter must support the provider's actual interaction model.

Inspect how Oh My Pi/Pi handles interactive terminal behavior and process lifecycle before implementing this layer.

Support where required:

* PTY
* stdin
* stdout
* stderr
* ANSI escape sequences
* terminal resize
* interactive prompts
* streamed output
* interrupts
* cancellation
* process exit
* crashes
* restart
* provider state
* session lifecycle

Do not treat the provider as:

```text
spawn → send prompt → wait → exit
```

unless that provider actually operates that way.

---

# 8. Provider Adapter Architecture

Create a provider-neutral adapter abstraction.

Conceptually:

```text
ProviderAdapter
├── lifecycle
├── interactive input
├── terminal/process transport
├── event capture
├── completion detection
├── interruption
├── restart/recovery
├── provider metadata
└── capability discovery
```

Pi must be the first complete implementation.

Then adapt the architecture to:

* Agy
* Claude Code
* future CLI harnesses

without making Sleekdo depend on provider-specific command lists.

---

# 9. Provider Command Passthrough Test

For each connected CLI:

1. Run the command directly in the provider.
2. Run the exact same command through Sleekdo.
3. Compare behavior.
4. Confirm the provider, not Sleekdo, interpreted it.
5. Confirm interactive commands remain interactive.
6. Confirm provider state changes persist correctly.
7. Confirm Sleekdo orchestration state is unaffected.

Test commands that:

* change model
* modify settings
* configure tools
* create/change sessions
* show help
* invoke interactive menus
* require confirmation
* accept additional input
* return errors

---

# 10. Study and Integrate Oh My Pi's Tool Architecture

Oh My Pi currently exposes a large built-in tool surface, with tools for files/search, runtime execution, code intelligence, coordination, and desktop/web capabilities.

Do not merely reproduce the names.

Study how each tool is implemented:

* schema
* prompt
* execution
* validation
* timeout
* cancellation
* error handling
* output formatting
* persistence
* context management
* tests
* configuration

Then integrate the proven mechanisms into Sleekdo.

---

# 11. LSP — Use the Proven Architecture

Implement Sleekdo LSP based directly on the current Oh My Pi LSP architecture.

Inspect the current implementation of:

* LSP client lifecycle
* JSON-RPC transport
* configuration
* server selection
* auto-detection
* lspmux integration
* WorkspaceEdit handling
* text edits
* URI/path conversion
* symbol resolution
* formatting
* client caching
* linter integration
* types
* model-facing tool schema
* tests

Oh My Pi explicitly separates these responsibilities across its LSP client, configuration, multiplexer, edit, utility, type, and client layers.

Do not collapse everything into one simplistic LSP class.

Support the useful LSP operations exposed by the reference implementation, including:

* diagnostics
* definition
* references
* symbols
* hover
* rename
* code actions
* formatting
* capabilities
* raw requests where appropriate

Use the current Oh My Pi implementation and documentation as the source of truth for behavior.

---

# 12. LSP Diagnostics Integration

LSP diagnostics should integrate into Sleekdo rather than existing as an isolated feature.

Where appropriate:

```text
file edit
    ↓
LSP
    ↓
diagnostics
    ↓
A1 evidence
    ↓
A3 review evidence
```

Study the current Oh My Pi configuration around:

* diagnostics on write
* diagnostics on edit
* deduplication
* formatting behavior

The current settings expose these as explicit controls.

Preserve the useful configurability rather than hard-coding behavior.

---

# 13. Real Debugger — DAP

Implement a real debugger.

Do not build a simulated debugger.

Use DAP architecture and inspect the current Oh My Pi implementation before writing Sleekdo's version.

Study:

* DAP client transport
* adapter process/socket lifecycle
* session state
* breakpoint cache
* adapter resolution
* auto-selection
* configuration
* request/response handling
* capability negotiation
* timeout behavior
* interactive debug UI
* logging
* diagnostics
* reports
* profiling/system diagnostic reuse where applicable

Oh My Pi's current debug implementation separates these concerns across DAP session/client/config/type layers and an interactive debug UI.

Implement:

* launch
* attach where supported
* breakpoints
* conditional breakpoints
* continue
* pause
* step over
* step into
* step out
* stack frames
* scopes
* variables
* threads
* evaluate/watch
* exceptions
* debug output
* termination
* adapter lifecycle

---

# 14. Debugger Integration With Sleekdo Debugging

A1 must be able to use the debugger as a genuine diagnostic instrument.

A debugging investigation should be able to produce evidence such as:

```text
failure
→ hypothesis
→ breakpoint
→ runtime state
→ stack
→ variable values
→ surviving mechanism
→ fix
→ rerun
```

A3 should be able to independently inspect the resulting evidence.

This must integrate with the existing Sleekdo evidence-driven debugging system.

---

# 15. Hashline — Use the Proven Implementation Method

Implement Hashline using the current Oh My Pi/hashline implementation as the primary reference.

The current implementation is not simply "line numbers with hashes."

It includes:

* content hashes
* snapshot storage
* filesystem abstraction
* patch parsing
* patch application
* stale-anchor detection
* recovery
* three-way merge behavior
* line-ending/BOM normalization
* multi-section preflight
* in-memory filesystem support
* custom backend support

These details must be preserved where applicable.

Do not replace this with a simplistic:

```text
lineNumber + hash
```

implementation.

---

# 16. Hashline Safety Requirements

A stale edit must be rejected rather than silently corrupting code.

The implementation must:

1. capture/record the appropriate content snapshot;
2. associate edits with content hashes;
3. verify anchors;
4. detect divergence;
5. attempt the reference implementation's supported recovery mechanism;
6. refuse unsafe application;
7. provide useful failure information;
8. maintain atomicity.

Multi-section edits must be preflighted so a partially valid patch cannot leave a partially applied batch.

---

# 17. Hashline Configuration

Study and reproduce the useful configuration concepts from the current Oh My Pi settings.

Current Oh My Pi exposes options including:

* edit mode
* fuzzy matching
* fuzzy threshold
* generated-file blocking
* streaming-abort behavior

and uses Hashline as the default edit mode.

Adapt these into Sleekdo configuration rather than blindly copying names if the Sleekdo configuration model differs.

---

# 18. File/Read/Search Tooling

Study Oh My Pi's current approach to:

* read
* write
* edit
* grep
* glob
* AST search
* AST editing
* archive/file handling
* remote/internal paths
* output summarization
* result truncation

The goal is not just to add commands.

The goal is to reproduce the engineering properties that make the tooling reliable for coding agents.

For example, the current Oh My Pi surface explicitly uses summarized reads and structured search/edit capabilities rather than relying only on raw shell commands.

---

# 19. Persistent Processes and Runtime Tools

Study and integrate the proven mechanisms for:

* long-running processes
* background jobs
* process cancellation
* process output
* shell execution
* PTY behavior
* persistent interpreter sessions
* runtime state

These capabilities are particularly important for Sleekdo's debugging and verification loop.

---

# 20. Subagents and Parallel Work

Study the current Oh My Pi task/subagent architecture.

Where compatible, integrate useful techniques for:

* spawning subagents
* isolated work
* communication
* waiting
* cancellation
* background work

However, do not allow provider subagents to bypass Sleekdo's authoritative A1/A2/A3 state machine.

Sleekdo remains the authority.

---

# 21. Artifact and Context Storage

Study Oh My Pi's current artifact/blob/session architecture.

Its current architecture separates content-addressed blobs from session-scoped artifacts, including storage of large tool outputs and provider payloads outside the main session JSONL.

Use the underlying idea where it improves Sleekdo:

* large outputs should not unnecessarily inflate core state
* artifacts should have stable references
* large provider/tool outputs should be externally stored
* task evidence should remain accessible
* session state should remain compact
* content-addressed storage should be considered for deduplication/integrity

Integrate this with Sleekdo's existing task evidence model.

---

# 22. Sleekdo TUI Design

Study the current Oh My Pi TUI directly.

Inspect:

* layout
* input box
* prompt
* tool rendering
* status areas
* streaming
* menus
* selection interfaces
* dialogs
* progress
* errors
* keyboard handling
* terminal resizing
* command completion
* context display
* debug UI
* logs

Then implement the equivalent interaction quality in Sleekdo.

Do not create a superficial visual clone.

The resulting UI should feel native to Sleekdo.

---

# 23. Sleekdo Visual Identity

Use Oh My Pi's interaction quality and information density as the reference, but establish a distinct Sleekdo visual identity.

Primary brand accent:

**green**

Use semantic colors independently where necessary:

```text
green  = healthy / success / approved
yellow = warning
red    = error / blocker
neutral = information
```

Do not force everything to green if that damages semantic clarity.

---

# 24. Command Completion

Study how the current Oh My Pi implementation generates shell completions from live command/flag metadata rather than maintaining a drifting hand-written command list.

Implement equivalent Sleekdo-native completion for:

```text
//...
```

Provider-native completion should remain provider-owned.

Do not attempt to reproduce an unknown provider's command catalog manually.

If the provider exposes completion metadata/API, use it.

If not, preserve provider-native interactive behavior through the terminal transport.

---

# 25. Provider Command Completion

The `/` namespace must remain open.

Sleekdo must not require:

```text
knownCommands = [...]
```

for provider routing.

The provider is authoritative.

If the provider exposes a dynamic command catalog, Sleekdo may use it for completion/display, but routing must never depend on that catalog.

---

# 26. Configuration Architecture

Study Oh My Pi's current configuration model and identify reusable patterns for:

* LSP
* edit modes
* debugger
* tools
* shell
* read behavior
* diagnostics
* formatting
* provider/model settings
* session behavior

Integrate these into Sleekdo without creating conflicting sources of truth.

Provider configuration remains provider-owned.

Sleekdo configuration controls Sleekdo.

Project configuration remains project-owned.

---

# 27. Tool Permissions

Provider tools and Sleekdo tools must have clear permission boundaries.

Do not automatically approve dangerous provider prompts.

Do not bypass provider security.

Do not allow a provider command to mutate authoritative Sleekdo state.

Provider-native configuration may alter provider behavior, but it cannot:

* approve an A3 review
* mark a Sleekdo task complete
* skip required tasks
* modify authoritative orchestration state
* bypass workspace protection

---

# 28. A1 Integration

A1 must receive the improved developer tool surface.

A1 can use:

* Hashline
* LSP
* debugger
* shell
* process management
* search
* AST tooling
* tests
* Git
* browser/computer capabilities where configured
* other appropriate tools

A1 remains unaware of supervision.

A1's claims remain non-authoritative.

---

# 29. A2 Integration

A2 must be able to use the richer evidence generated by the new tooling.

For example:

```text
LSP diagnostics
runtime debugger state
test output
build output
process state
dependency information
dead-code analysis
Git changes
runtime traces
```

A2 uses this evidence during recursive project reassessment.

---

# 30. A3 Integration

A3 receives appropriate evidence and independently verifies the implementation.

A3 can inspect:

* source
* LSP diagnostics
* runtime state
* debugger evidence
* tests
* builds
* Git state
* task artifacts
* generated reports

A3 remains a fresh session per review.

---

# 31. Evidence-Driven Debugging

Integrate the new debugger/LSP/runtime capabilities with Sleekdo's existing debugging policy.

Never:

```text
guess → change random code → hope
```

Instead:

```text
failure
↓
candidate hypotheses
↓
highest-information diagnostic
↓
runtime evidence
↓
eliminate hypotheses
↓
surviving mechanism
↓
confirm mechanism directly
↓
smallest reasonable fix
↓
rerun
↓
regression verification
```

The debugger and LSP exist to make this loop evidence-rich.

---

# 32. Dead-Code and Cleanup Integration

Use the richer code-intelligence surface to improve recurring:

* dead-file detection
* dead-function detection
* dead-import detection
* unused dependency detection
* obsolete branch detection
* stale test detection
* stale configuration detection

Do not delete dynamic code merely because static analysis cannot find a reference.

Classify candidates before removal.

Cleanup remains an A1 task requiring A3 approval.

---

# 33. Recursive Project Reassessment

After every approved task:

1. A2 reassesses the entire project.
2. Inspect new evidence.
3. Inspect integration.
4. Inspect architecture.
5. Inspect runtime behavior.
6. Inspect diagnostics.
7. Inspect tests.
8. Inspect cleanup state.
9. Discover new requirements.
10. Create new tasks.
11. Continue until the project reaches a verified fixed point.

The new Oh My Pi-class tooling should improve the quality of this reassessment.

---

# 34. Native Provider Commands During Orchestration

A provider-native command may alter the worker's model or provider configuration.

That is allowed.

However, Sleekdo must still know:

* which provider is connected
* current provider session
* worker lifecycle
* task identity
* orchestration state

Provider commands cannot silently cause Sleekdo to lose control of the worker lifecycle.

---

# 35. Session and Crash Recovery

Study proven provider/session recovery methods.

Sleekdo must recover from:

* worker crash
* provider crash
* terminal failure
* interrupted process
* machine restart where persisted state allows
* malformed provider output
* partially completed task
* interrupted review
* interrupted debugging session

Never mark work complete merely because the process stopped.

---

# 36. Testing Method

Do not only compile.

For each imported Oh My Pi-class feature:

1. inspect the upstream implementation;
2. understand the mechanism;
3. implement/adapt;
4. write unit tests;
5. write integration tests;
6. write failure tests;
7. run the real feature against a real project;
8. compare behavior against the reference where applicable;
9. test interaction through the Sleekdo TUI;
10. test integration with A1/A2/A3.

---

# 37. Pi Compatibility Test

Pi is already installed on the development machine.

Use it as the primary real-world provider.

Test:

### Provider

```text
sleekdo --pi
```

### Normal input

```text
Build a small application...
```

### Native commands

Exercise the installed Pi's actual current command surface.

Do not assume the command list from documentation is exhaustive.

Discover the commands supported by the installed version.

Test them through Sleekdo.

### Sleekdo commands

```text
//help
//status
//tasks
//plan
//pause
//resume
//review
//verify
```

### Boundary test

```text
//status
```

must never reach Pi.

```text
/help
```

must reach Pi.

```text
/model
```

must reach Pi.

A future unknown:

```text
/new-provider-command
```

must also reach Pi without requiring a Sleekdo allowlist.

---

# 38. Exact Native Behavior Test

For representative Pi commands:

```text
Direct Pi:
command → result

Sleekdo:
same command → result
```

Verify:

* same provider interpretation
* same command semantics
* same state change
* same interactive behavior
* same error behavior
* same model/configuration result

Sleekdo may render the result inside its own UI, but it must not change what the provider does.

---

# 39. LSP Acceptance Test

Create a small real project.

Verify:

* server detection
* initialization
* diagnostics
* definition
* references
* symbols
* hover
* rename
* code actions
* formatting
* workspace edits
* server restart/recovery
* malformed server behavior
* timeout behavior

Compare implementation decisions against the current Oh My Pi implementation before accepting the Sleekdo implementation.

---

# 40. Debugger Acceptance Test

Create a deliberately buggy program.

Use Sleekdo's debugger to:

1. launch it;
2. hit a breakpoint;
3. inspect stack;
4. inspect variables;
5. step;
6. identify the actual incorrect state;
7. fix it;
8. rerun;
9. verify.

The debugger must use real runtime state.

---

# 41. Hashline Acceptance Test

Create a file.

1. Create a hashline patch.
2. Modify the file independently.
3. Attempt to apply the stale patch.
4. Verify stale detection.
5. Verify safe recovery where supported.
6. Verify unsafe edits are rejected.
7. Test multi-section atomicity.
8. Test line endings.
9. Test BOM handling.
10. Test in-memory filesystem behavior if supported.

---

# 42. Terminal Acceptance Test

Test:

* ANSI
* color
* cursor movement
* streaming
* resize
* multiline input
* Ctrl-C
* interactive menus
* provider prompts
* Sleekdo commands
* provider commands
* long output
* errors
* process restart

The terminal must remain usable under all tested conditions.

---

# 43. No Feature Regression

Before declaring the work complete:

* run the entire existing Sleekdo test suite;
* run new tests;
* run integration tests;
* run Pi tests;
* run provider lifecycle tests;
* run orchestration tests;
* run crash/recovery tests;
* run workspace safety tests;
* run final end-to-end tests.

Do not remove existing Sleekdo functionality to make the new architecture easier.

---

# 44. Documentation

Update documentation to explain the central interface:

```text
//command
    = Sleekdo

/command
    = connected CLI

ordinary input
    = connected CLI
```

Document that provider commands are intentionally not limited to a fixed list.

Document that the connected CLI remains responsible for interpreting its own native commands.

Document the new:

* LSP
* debugger
* Hashline
* developer tools
* provider architecture
* TUI
* configuration
* debugging workflow

---

# 45. Final Architecture

The target architecture is:

```text
                         USER
                          │
                          ▼
                 ┌─────────────────┐
                 │  SLEEKDO TUI    │
                 │  Input/Renderer │
                 └────────┬────────┘
                          │
                    ┌─────┴─────┐
                    │ Input     │
                    │ Router    │
                    └─────┬─────┘
                          │
              ┌───────────┴───────────┐
              │                       │
          starts //               everything else
              │                       │
              ▼                       ▼
       SLEEKDO COMMANDS       CONNECTED CLI
              │                       │
              │                ┌──────┴──────┐
              │                │             │
              │               Pi            Agy
              │                │             │
              │             Claude       Future CLI
              │
              ▼
       SLEEKDO ORCHESTRATOR
              │
       ┌──────┼──────┐
       ▼      ▼      ▼
      A1     A2     A3
   Worker  Planner Reviewer
       │      │      │
       └──────┼──────┘
              │
       Developer Tool Layer
              │
   ┌──────────┼─────────────────────┐
   ▼          ▼          ▼          ▼
  LSP       DAP      Hashline    Runtime
   │          │          │          │
   └──────────┴──────────┴──────────┘
              │
              ▼
        Project Workspace
```

---

# 46. Governing Rules

The implementation agent must follow these rules throughout the work:

### Rule 1 — Inspect before implementing

Never implement an Oh My Pi feature from memory when the current upstream source is available.

### Rule 2 — Use proven mechanisms

Where Oh My Pi has a mature solution, understand and adapt that solution instead of inventing an inferior replacement.

### Rule 3 — Preserve Sleekdo's architecture

Oh My Pi's techniques are the reference implementation for developer tooling.

Sleekdo's A1/A2/A3 orchestration remains the authority for orchestration.

### Rule 4 — Provider commands remain native

Never reduce a connected CLI to a hard-coded list of commands.

### Rule 5 — `//` belongs to Sleekdo

Everything else belongs to the connected CLI.

### Rule 6 — Do not fake developer tooling

LSP must be real LSP.

Debugging must be real DAP/debugger integration.

Hashline must provide actual stale-edit protection and snapshot-aware behavior.

### Rule 7 — Test real behavior

Compilation is not acceptance.

Real Pi sessions, real projects, real debugging, real LSP servers, real stale edits, real failures, and real recovery must be tested.

### Rule 8 — Preserve upstream attribution/licensing

Inspect and comply with the actual Oh My Pi license and attribution requirements before reusing code.

### Rule 9 — Do not silently simplify

If an upstream feature contains a non-obvious mechanism, understand why it exists before removing it.

### Rule 10 — Sleekdo must remain the authority

Provider functionality can be unrestricted.

Provider commands cannot bypass Sleekdo's authoritative task/review state.

---

# 47. Definition of Done

This work is complete only when:

* the current Sleekdo repository has been audited;
* the current Oh My Pi repository has been audited;
* relevant Oh My Pi source implementations have been inspected;
* licensing has been checked;
* LSP is implemented using the proven architecture;
* DAP debugging is implemented using the proven architecture;
* Hashline is implemented using the proven architecture;
* the relevant developer tooling has been integrated;
* the TUI has been upgraded using the proven interaction patterns;
* Sleekdo has its own green visual identity;
* provider commands remain unrestricted;
* `//` routes exclusively to Sleekdo;
* everything else routes to the connected CLI;
* Pi works as a real connected provider;
* native Pi commands work through Sleekdo;
* interactive provider commands work;
* provider model/settings/tool/session commands work;
* unknown/future provider commands are not blocked by Sleekdo;
* A1 can use the new developer tools;
* A2 can use their evidence;
* A3 can independently verify their results;
* crash/recovery behavior works;
* workspace protection remains intact;
* existing Sleekdo behavior remains intact;
* comprehensive tests pass;
* real end-to-end Pi tests pass;
* documentation is updated;
* final dead-code/dead-file analysis is performed;
* final fresh A3 verification approves the complete implementation.

The final product must feel like a **single coherent Sleekdo coding environment**, not a collection of copied features and not a wrapper around Pi.

The central design principle is:

```text
SLEEKDO OWNS:
orchestration
task state
A1/A2/A3
verification
workspace authority
user interface
Sleekdo commands

CONNECTED CLI OWNS:
its native commands
models
provider settings
provider tools
provider sessions
provider-specific behavior
provider-specific interaction

OH MY PI PROVIDES:
battle-tested implementation references
for LSP
DAP
Hashline
developer tooling
TUI interaction patterns
tool architecture
runtime techniques
```

The implementation agent must inspect the **current upstream Oh My Pi source at implementation time** and use it as the technical reference rather than treating this document as a substitute for reading the source.
