import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

type Slice = {
  seed: number
  model: string
  passes: number
  spendCapUsd: number
  ids: string[]
}

type ManifestBody = {
  mode: string
  seed: number
  model: string
  passes: number
  spendCapUsd: number
  ids: string[]
  requests: { id: string; model: string }[]
}

type Manifest = ManifestBody & { runId: string }

type FetchImpl = (...args: unknown[]) => unknown

export async function dryRun({
  root,
  outDir,
  fetchImpl: _fetchImpl,
}: {
  root: string
  outDir: string
  fetchImpl: FetchImpl
}): Promise<{ manifestPath: string; bytes: Buffer }> {
  const slicePath = path.join(root, "eval/baseline/slice.json")
  const raw = await readFile(slicePath, "utf8")
  const slice = JSON.parse(raw) as Slice

  const body: ManifestBody = {
    mode: "dry-run",
    seed: slice.seed,
    model: slice.model,
    passes: slice.passes,
    spendCapUsd: slice.spendCapUsd,
    ids: slice.ids,
    requests: slice.ids.map((id) => ({ id, model: slice.model })),
  }

  const runId = createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 12)

  const manifest: Manifest = {
    runId,
    mode: body.mode,
    seed: body.seed,
    model: body.model,
    passes: body.passes,
    spendCapUsd: body.spendCapUsd,
    ids: body.ids,
    requests: body.requests,
  }

  const bytes = Buffer.from(JSON.stringify(manifest))
  const manifestPath = path.join(outDir, "runs", runId, "manifest.json")
  await mkdir(path.dirname(manifestPath), { recursive: true })
  await writeFile(manifestPath, bytes)

  return { manifestPath, bytes }
}

export async function liveRun({
  root: _root,
  confirmSpend,
  env,
  fetchImpl: _fetchImpl,
}: {
  root: string
  confirmSpend: number
  env: NodeJS.ProcessEnv
  fetchImpl: FetchImpl
}): Promise<{ ok: boolean; reason: string }> {
  const key = env.OPENAI_API_KEY
  if (key === undefined || key === "") {
    return { ok: false, reason: "refusing live run: OPENAI_API_KEY is missing" }
  }
  if (confirmSpend !== 10) {
    return { ok: false, reason: "refusing live run: pass --confirm-spend 10" }
  }
  return {
    ok: false,
    reason: "refusing live run: spend is armed but this phase does not call the provider",
  }
}

function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
}

function parseConfirmSpend(argv: string[]): number | undefined {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--confirm-spend" && argv[i + 1] !== undefined) {
      return Number(argv[i + 1])
    }
    const eq = arg?.match(/^--confirm-spend=(.+)$/)
    if (eq) {
      return Number(eq[1])
    }
  }
  return undefined
}

const modulePath = fileURLToPath(import.meta.url)
const invoked = process.argv[1] ? path.resolve(process.argv[1]) === path.resolve(modulePath) : false

if (invoked) {
  const argv = process.argv.slice(2)
  const root = repoRoot()

  if (argv.includes("--dry-run")) {
    const { manifestPath } = await dryRun({
      root,
      outDir: root,
      fetchImpl: () => {
        throw new Error("network")
      },
    })
    console.log(manifestPath)
    process.exit(0)
  }

  const confirmSpend = parseConfirmSpend(argv) ?? NaN
  const result = await liveRun({
    root,
    confirmSpend,
    env: process.env,
    fetchImpl: () => {
      throw new Error("network")
    },
  })
  console.error(result.reason)
  process.exit(1)
}