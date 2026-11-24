# Security

Trace Anything has a local CLI. There is no shipped server.

## How to report

Please report a vulnerability through [GitHub private vulnerability reporting](https://github.com/Troy-LL/trace-anything/security/advisories/new). Do not file a public issue or a pull request that describes the problem in detail.

## Planned surface

The CLI exposes `loop`, `generate`, `render`, and `score`. It builds a section with Vite and, on macOS, compiles the Vision OCR helper in this repo. It does not take a user shell command. The optional two-tool MCP server, if it is built later, only searches and executes against that typed surface, in a sandbox. It must not grow into one tool per command, and it must not widen the surface past that typed API.

Do not send secrets in issues, chat, or sample traces.
