# Security

Trace Anything is at spec stage. There is no shipped server or CLI yet.

## How to report

Please report a vulnerability through [GitHub private vulnerability reporting](https://github.com/Troy-LL/trace-anything/security/advisories/new). Do not file a public issue or a pull request that describes the problem in detail.

## Planned surface

When the MCP server and CLI exist, they will only expose the documented tools: segment, extract, generate, render, score, loop, and assemble. The MCP server never runs arbitrary commands. Transport is stdio by default. HTTP is optional later, and it must not widen that command surface.

Do not send secrets in issues, chat, or sample traces.
