# Intermediate format and adapters

Status: Accepted

## Context

A naive generator would emit React, Tailwind, or another concrete stack directly from the image. Each new stack would then fork the render and score loop, and scores would not be comparable.

## Decision

We will write one framework-neutral intermediate component description (the spec plus the tree). Per-target adapters emit the code. The Playwright scoring loop stays the same for every stack.

The first adapter is plain TS plus Vite plus static, and is the reference adapter. The second is React plus Vite. Users pick framework, build tool, styling (and optionally their own component library or tokens), and deploy target. Deploy config is generated. Nothing is deployed.

## Consequences

Adding a stack means adding an adapter, not a new scorer. Adapter quality is judged by a documented score gap against the reference adapter on the same eval set. Generating framework-specific code that bypasses the intermediate format is a bug, even if the screenshot looks close.
