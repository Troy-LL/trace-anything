# Agent map

Load this file. Then at most two others this turn, or three if this turn needs `docs/eval.md`. Skip unused. Cite paths. Do not paste.

- What it is: `README.md` when you need the planned `trace` CLI, the MCP surface, or current limits
- Topology: `docs/architecture.md` when data flow, processes, adapters, or where scoring sits comes up
- Interface: `docs/design.md` when CLI commands, MCP tools, or operator-facing behavior comes up
- Scored probe: `docs/eval.md` when a baseline, combined score, gold command, or score path comes up
- Intermediate format: `docs/decisions/001-intermediate-format-and-adapters.md` when generating framework-specific code without the intermediate format looks useful; read before adding an adapter or bypassing the tree
- Harness surface: `docs/decisions/002-harness-neutral-interface.md` when an IDE-specific core or a plugin-only interface looks useful; read before adding editor code
- Section scope: `docs/decisions/003-section-first.md` when generating a whole page in one shot looks useful; read before widening input past one section
- Page segment: `docs/decisions/004-full-page-segment-and-assemble.md` when feeding a whole-page image straight into generate looks useful; read before skipping `segment` or treating a page as one section

Verify the docs with `bash scripts/verify-docs.sh`. Do not put IDE-specific code in the core. Do not deploy; only generate deploy config. Do not skip the intermediate format. Do not add `CONTEXT.md` or `GLOSSARY.md`.

Park thinking in `scratch/`. Do not map it, even if they asked.
Do not commit it.
