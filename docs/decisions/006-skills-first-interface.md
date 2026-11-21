# Skills-first interface

Status: Accepted

## Context

Decision 002 made a CLI plus a full MCP server the primary way to call Trace Anything from an agent. That would ship one MCP tool per operation (segment, extract, generate, render, score, loop, assemble). A catalog that size is expensive in agent context, and it would make MCP a requirement for any editor or harness.

The better pattern, following [Cloudflare's current agent interface](https://developers.cloudflare.com/agents/model-context-protocol/cloudflare/servers-for-cloudflare/), is a skills pack the agent installs, plus the CLI as the engine those skills call. A remaining MCP server, if any, stays tiny.

## Decision

The core stays an editor-neutral library. The `trace` CLI (JSON in and out) stays the engine.

The primary agent interface is an Agent Skills pack: SKILL.md folders that follow the Agent Skills standard. The skills teach any agent to drive the CLI for segment, a section loop, score, the fix loop, and assemble. Install is planned as:

```sh
npx skills add https://github.com/Troy-LL/trace-anything
```

The same folders can be copied into `~/.cursor/skills`, `~/.claude/skills`, or `~/.codex/skills`.

A tiny MCP server is an optional extra. If it exists, it exposes two tools in the Code Mode pattern: `search` over the typed CLI and library surface, and `execute`, which runs a short script against that surface in a sandbox. The point is to keep context cost around a thousand tokens, instead of one tool per operation. That server is not required for anything, including the MVP.

No IDE-specific code belongs in the core. Editor integrations stay thin wrappers and stay out of scope for v0.1.

## Consequences

Decision 002 is superseded. The editor-neutral library and the `trace` CLI still hold. The primary agent path is no longer a full MCP server.

Issue #4 ships the skills pack and the CLI. The optional two-tool MCP server is out of scope for that issue and for the MVP.

Decision 005 clause 3 is the same run from the CLI and from an agent via the skills pack, with JSON in and out.

A change that only works inside one editor is still incomplete.

## Alternatives considered

**A full MCP server (decision 002).** One tool per operation, over stdio and optionally HTTP. Rejected as the primary path because the catalog is expensive in agent context, and it would make MCP required for agents.

**CLI only, with no skills pack.** Agents would have no packaged guidance for segment, the section loop, score, the fix loop, and assemble. Rejected because a skills pack is how agents in Cursor, Claude Code, Codex, and similar harnesses learn to drive a CLI consistently.
