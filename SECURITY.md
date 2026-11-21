# Security

Trace Anything is at spec stage. There is no shipped server or CLI yet.

## How to report

Please report a vulnerability through [GitHub private vulnerability reporting](https://github.com/Troy-LL/trace-anything/security/advisories/new). Do not file a public issue or a pull request that describes the problem in detail.

## Planned surface

When the CLI exists, it will only expose the documented commands: segment, extract, generate, render, score, loop, and assemble. It never runs arbitrary host commands. The optional two-tool MCP server, if it is built later, only searches and executes against that typed surface, in a sandbox. It must not grow into one tool per command, and it must not widen the surface past that typed API.

Do not send secrets in issues, chat, or sample traces.
