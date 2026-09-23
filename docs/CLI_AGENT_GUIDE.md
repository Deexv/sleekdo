# Connecting Sleekdo to CLI Agents

Sleekdo connects to external coding CLI agents through [`AgentAdapter`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/agent-adapter.ts). You can use any CLI agent that accepts text prompts and runs inside a terminal or standard process.

Configuration is stored in `.sleekdo/config.json`. You can also configure adapters programmatically through [`SleekdoConfig`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/config/config.ts).

## How Sleekdo communicates with agents

Sleekdo runs each agent turn as an isolated subprocess or pseudo-terminal session. The orchestrator injects structured role prompts into the agent, monitors process execution, captures output events, and enforces idle and maximum runtime timeouts.

Sleekdo supports two primary adapter implementations:

1. [`PiAdapter`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/pi-adapter.ts). Tailored integration for Pi CLI with streaming event capture.
2. [`GenericPTYAdapter`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/generic-pty-adapter.ts). Universal process adapter supporting Claude Code, Agy, Python scripts, shell scripts, and custom binaries.

## Installing agent backends on a fresh computer

Before running Sleekdo with an agent backend, install and authenticate that agent on your machine.

### Pi CLI setup

1. Install Pi CLI globally using npm:

```bash
npm install -g @earendil-works/pi-coding-agent
```

2. Configure your model provider in Pi before running Sleekdo.

3. Verify that the `pi` command is executable in your terminal:

```bash
pi --version
```

### Claude Code setup

1. Install Claude Code globally using npm:

```bash
npm install -g @anthropic-ai/claude-code
```

2. Export your Anthropic API key in your shell:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

3. Verify that the `claude` command is executable:

```bash
claude --version
```

### Google Antigravity (Agy) setup

1. Install the `agy` CLI utility and configure access.

2. Verify that `agy` is available in your PATH:

```bash
agy --version
```

## Fast launch commands (Section 97)

Per PRD Section 97, Sleekdo provides instant launcher flags and subcommands that automatically bind the target agent backend:

```bash
# Pi CLI
sleekdo --pi
sleekdo pi

# Google Antigravity (Agy)
sleekdo --agy
sleekdo agy

# Claude Code
sleekdo --claude
sleekdo claude
```

## The prompt placeholder

For commands that accept the prompt as a CLI flag or argument, use `{prompt}` inside the `args` array. Sleekdo replaces `{prompt}` with the structured role prompt at runtime.

If `{prompt}` is omitted from `args`, Sleekdo writes the prompt to the agent process standard input stream upon startup.

## Pi CLI configuration

Sleekdo includes first-class support for Pi CLI through [`PiAdapter`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/pi-adapter.ts).

Example configuration in `.sleekdo/config.json`:

```json
{
  "adapter": {
    "type": "pi",
    "command": "pi",
    "args": ["-p", "{prompt}", "--mode", "text"],
    "provider": "zai",
    "model": "glm-4.7"
  }
}
```

## Claude Code configuration

You can run Claude Code with Sleekdo via [`GenericPTYAdapter`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/generic-pty-adapter.ts).

Example configuration in `.sleekdo/config.json`:

```json
{
  "adapter": {
    "type": "pty",
    "command": "claude",
    "args": ["-p", "{prompt}", "--dangerously-skip-permissions"],
    "timeoutMs": 300000,
    "idleTimeoutMs": 30000,
    "env": {
      "ANTHROPIC_API_KEY": "your-api-key"
    }
  }
}
```

## Google Antigravity (Agy) configuration

You can connect Google Antigravity CLI agents using the generic PTY adapter.

Example configuration in `.sleekdo/config.json`:

```json
{
  "adapter": {
    "type": "pty",
    "command": "agy",
    "args": ["run", "--prompt", "{prompt}"],
    "timeoutMs": 300000,
    "idleTimeoutMs": 30000
  }
}
```

## Generic CLI and custom script configuration

You can wrap any local script, binary, or wrapper program with [`GenericPTYAdapter`](file:///C:/Users/ON%20GOD/Documents/code/SleekDo/src/adapters/generic-pty-adapter.ts).

Example configuration for a Python agent script:

```json
{
  "adapter": {
    "type": "pty",
    "command": "python",
    "args": ["agents/custom_agent.py", "--task", "{prompt}"],
    "timeoutMs": 180000
  }
}
```

Example configuration for a shell script that reads prompt from standard input:

```json
{
  "adapter": {
    "type": "pty",
    "command": "bash",
    "args": ["scripts/run_agent.sh"],
    "timeoutMs": 180000
  }
}
```

## Mixed per-role configuration

You can assign different CLI agents or models to A1, A2, and A3. For example, you can use a fast coding agent for A1 Worker, an architectural model for A2 Planner, and a rigorous reasoning agent for A3 Reviewer.

Example configuration in `.sleekdo/config.json`:

```json
{
  "adapter": {
    "type": "pi",
    "command": "pi",
    "args": ["-p", "{prompt}"]
  },
  "roles": {
    "a1": {
      "adapter": {
        "type": "pty",
        "command": "claude",
        "args": ["-p", "{prompt}", "--dangerously-skip-permissions"]
      }
    },
    "a2": {
      "adapter": {
        "type": "pi",
        "command": "pi",
        "args": ["-p", "{prompt}"],
        "model": "claude-3-7-sonnet"
      }
    },
    "a3": {
      "adapter": {
        "type": "pty",
        "command": "agy",
        "args": ["run", "--prompt", "{prompt}"]
      }
    }
  }
}
```

## Configuration parameters

All adapter configuration options reside inside the `adapter` object or per-role overrides:

- `type`. Adapter driver type. Allowed values are `"pi"`, `"pty"`, and `"mock"`.
- `command`. Executable binary name or file path to run.
- `args`. Array of command-line argument strings. Supports the `{prompt}` token.
- `provider`. Optional AI provider name passed to supported CLI tools like Pi.
- `model`. Optional model name passed to the CLI tool.
- `timeoutMs`. Maximum execution duration before Sleekdo terminates the process. Default is 300000 ms.
- `idleTimeoutMs`. Maximum silence duration without output events before process termination. Default is 60000 ms.
- `env`. Key-value mapping of custom environment variables injected into the agent process.
