import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

const packageRoot = path.resolve(import.meta.dirname, "..")
const traceScript = path.join(packageRoot, "src", "trace.ts")

function runTrace(argv: string[]): Promise<{ stdout: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", traceScript, ...argv], {
      cwd: packageRoot,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.on("error", reject)
    child.on("exit", (code) => resolve({ stdout, code }))
  })
}

test("trace generate success JSON includes runId from intermediate bytes", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "trace-cli-generate-"))
  const intermediate = path.join(dir, "intermediate.json")
  const project = path.join(dir, "project")
  const body = {
    schemaVersion: 1,
    sectionId: "sec-cli",
    source: { imageHash: "ab", bbox: { x: 0, y: 0, width: 40, height: 20 }, width: 40 },
    tokens: { colors: ["#112233"], spacing: [], fonts: [], radii: [] },
    fontSubstitutions: [],
    root: {
      id: "sec-cli",
      kind: "box",
      box: { x: 0, y: 0, width: 40, height: 20 },
      style: { background: "colors.0", color: "colors.0" },
      children: [],
      guesses: [],
    },
  }
  try {
    await writeFile(intermediate, JSON.stringify(body))
    const bytes = await readFile(intermediate)
    const expectedRunId = createHash("sha256").update(bytes).digest("hex").slice(0, 12)
    const result = await runTrace(["generate", "--intermediate", intermediate, "--out", project])
    assert.equal(result.code, 0)
    const payload = JSON.parse(result.stdout.trim()) as { ok: boolean; runId?: string }
    assert.equal(payload.ok, true)
    assert.equal(payload.runId, expectedRunId)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("trace render success JSON includes runId from project index.html bytes", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "trace-cli-render-"))
  const project = path.join(dir, "project")
  const dist = path.join(project, "dist")
  const out = path.join(dir, "shot.png")
  const indexHtml = path.join(project, "index.html")
  try {
    await mkdir(dist, { recursive: true })
    await writeFile(
      indexHtml,
      `<!doctype html><html><body style="margin:0;width:20px;height:12px;background:#3366ff"></body></html>`,
    )
    await writeFile(
      path.join(dist, "index.html"),
      await readFile(indexHtml, "utf8"),
    )
    const bytes = await readFile(indexHtml)
    const expectedRunId = createHash("sha256").update(bytes).digest("hex").slice(0, 12)
    const result = await runTrace(["render", "--project", project, "--width", "20", "--out", out])
    assert.equal(result.code, 0)
    const payload = JSON.parse(result.stdout.trim()) as { ok: boolean; runId?: string }
    assert.equal(payload.ok, true)
    assert.equal(payload.runId, expectedRunId)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})