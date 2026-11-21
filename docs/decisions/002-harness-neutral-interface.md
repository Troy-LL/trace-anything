# Harness-neutral interface

Status: Accepted

## Context

It would look right to ship Trace Anything as a plugin for one editor. That would lock the loop to that harness and force every other environment to reimplement it.

## Decision

We will keep the core an editor-neutral library, and expose the same operations through a CLI (`trace` commands with JSON in and out) and an MCP server (stdio, and optionally HTTP). The tools are segment, extract the spec, generate, render, score, the full loop, and assemble. Cursor, VS Code, Claude Code, Codex, Zed, or any MCP-capable harness can call that server. No IDE-specific code belongs in the core. Editor integrations are thin wrappers and are out of scope for v0.1.

## Consequences

The issue #2 loop must be runnable via the CLI. A change that only works inside one editor is incomplete. HTTP is optional in the first MCP pass; stdio is required.
