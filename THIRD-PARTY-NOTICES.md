# Third-Party Notices and Attribution

Sleekdo incorporates developer-tooling architecture, patterns, and methods adapted from the **Oh My Pi** project.

## Oh My Pi

* Upstream Project: Oh My Pi (OMP)
* Source Repository: https://github.com/can1357/oh-my-pi
* Package: `@oh-my-pi/pi-coding-agent`
* Authors and Copyright Holders:
  * Copyright (c) 2025 Mario Zechner
  * Copyright (c) 2025-2026 Can Bölük
  * Copyright (c) 2026 Stencil Labs, Inc.
* License: MIT License

### MIT License Text

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Attribution Notes

Sleekdo adapts proven developer-tooling techniques from Oh My Pi under the MIT License, specifically:
- Hashline snapshot-aware, content-hash line editing and patch safety preflight
- Language Server Protocol (LSP) client transport, server resolution, and diagnostics ledger
- Debug Adapter Protocol (DAP) client transport and runtime debugging sessions
- Structured file and code search primitives
- Long-lived process management and terminal streaming patterns

Sleekdo retains its own independent orchestration authority, state machine, and A1/A2/A3 supervisor architecture.
