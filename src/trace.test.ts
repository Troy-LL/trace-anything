import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import zlib from "node:zlib"
import { runLoop } from "./loop.ts"
import { SECTION_LABELS } from "./records.ts"

const packageRoot = path.resolve(import.meta.dirname, "..")
const traceScript = path.join(packageRoot, "src", "trace.ts")

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(body))
  return Buffer.concat([length, body, crc])
}

function stripePng(width: number, bands: { height: number; rgb: [number, number, number] }[]): Buffer {
  const height = bands.reduce((sum, band) => sum + band.height, 0)
  const raw = Buffer.alloc((width * 4 + 1) * height)
  let y = 0
  for (const band of bands) {
    for (let row = 0; row < band.height; row += 1) {
      const offset = (y + row) * (width * 4 + 1)
      raw[offset] = 0
      for (let x = 0; x < width; x += 1) {
        const pixel = offset + 1 + x * 4
        raw[pixel] = band.rgb[0]
        raw[pixel + 1] = band.rgb[1]
        raw[pixel + 2] = band.rgb[2]
        raw[pixel + 3] = 255
      }
    }
    y += band.height
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

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

test("trace segment writes annotations, overlay, and section crops and does not generate", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "trace-cli-segment-"))
  const image = path.join(dir, "page.png")
  const png = stripePng(20, [
    { height: 10, rgb: [255, 0, 0] },
    { height: 10, rgb: [255, 255, 255] },
    { height: 10, rgb: [7, 22, 51] },
  ])
  await writeFile(image, png)
  try {
    const expectedRunId = createHash("sha256").update(png).digest("hex").slice(0, 12)
    const result = await runTrace(["segment", "--image", image, "--out", dir])
    assert.equal(result.code, 0)
    const payload = JSON.parse(result.stdout.trim()) as {
      ok: boolean
      command: string
      runId: string
      data: { annotations: { sections: { id: string; label: string }[] }; overlay: string }
    }
    assert.equal(payload.ok, true)
    assert.equal(payload.command, "segment")
    assert.equal(payload.runId, expectedRunId)
    const runDir = path.join(dir, "runs", expectedRunId)
    const annotations = JSON.parse(await readFile(path.join(runDir, "annotations.json"), "utf8")) as {
      sections: { id: string; label: string }[]
    }
    assert.equal(annotations.sections.length, 3)
    assert.deepEqual(
      annotations.sections.map((section) => section.label),
      payload.data.annotations.sections.map((section) => section.label),
    )
    await readFile(payload.data.overlay)
    await readFile(path.join(runDir, "overlay.png"))
    for (const section of annotations.sections) {
      await readFile(path.join(runDir, "sections", section.id, "source.png"))
      await assert.rejects(readFile(path.join(runDir, "sections", section.id, "pass-1", "intermediate.json")))
    }
    await assert.rejects(readFile(path.join(runDir, "out", "index.html")))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("trace segment --review stops before generation", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "trace-cli-review-"))
  const image = path.join(dir, "page.png")
  await writeFile(image, stripePng(20, [{ height: 12, rgb: [10, 20, 40] }]))
  try {
    const result = await runTrace(["segment", "--image", image, "--out", dir, "--review"])
    assert.equal(result.code, 0)
    const payload = JSON.parse(result.stdout.trim()) as {
      ok: boolean
      runId: string
      warnings: { code: string }[]
    }
    assert.equal(payload.ok, true)
    assert.equal(
      payload.warnings.some((warning) => warning.code === "review"),
      true,
    )
    const runDir = path.join(dir, "runs", payload.runId)
    await readFile(path.join(runDir, "annotations.json"))
    await readFile(path.join(runDir, "overlay.png"))
    await readFile(path.join(runDir, "sections", "sec-01", "source.png"))
    await assert.rejects(readFile(path.join(runDir, "sections", "sec-01", "pass-1", "intermediate.json")))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("trace extract writes one intermediate description for a section image", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "trace-cli-extract-"))
  const image = path.join(dir, "section.png")
  const out = path.join(dir, "intermediate.json")
  await writeFile(image, stripePng(20, [{ height: 16, rgb: [255, 0, 0] }]))
  try {
    const result = await runTrace(["extract", "--image", image, "--out", out])
    assert.equal(result.code, 0)
    const payload = JSON.parse(result.stdout.trim()) as {
      ok: boolean
      command: string
      data: {
        path: string
        intermediate: {
          schemaVersion: number
          tokens: { colors: string[] }
          root: { kind: string; children: { kind: string; text?: string; style?: { color?: string } }[] }
        }
      }
    }
    assert.equal(payload.ok, true)
    assert.equal(payload.command, "extract")
    assert.equal(payload.data.path, out)
    const description = JSON.parse(await readFile(out, "utf8")) as typeof payload.data.intermediate
    assert.equal(description.schemaVersion, 1)
    assert.equal(description.root.kind, "box")
    assert.match(description.tokens.colors[0] ?? "", /#ff0000/i)
    const body = JSON.stringify(description)
    assert.equal(body.includes("background-image"), false)
    assert.equal(body.includes("data:image"), false)
    const labels = new Set<string>(SECTION_LABELS)
    for (const child of description.root.children) {
      if (child.kind === "text" && child.text && labels.has(child.text)) {
        assert.equal(child.style?.color, "transparent")
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("trace assemble writes out/score.json from pass-1 intermediates", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "trace-cli-assemble-"))
  const image = path.join(dir, "page.png")
  await writeFile(
    image,
    stripePng(20, [
      { height: 10, rgb: [255, 0, 0] },
      { height: 10, rgb: [255, 255, 255] },
    ]),
  )
  try {
    const looped = await runLoop({ image, outDir: dir, seed: 1 })
    const runDir = path.join(dir, "runs", looped.runId)
    await rm(path.join(runDir, "out"), { recursive: true, force: true })
    const result = await runTrace(["assemble", "--run", runDir])
    assert.equal(result.code, 0)
    const payload = JSON.parse(result.stdout.trim()) as {
      ok: boolean
      command: string
      data: { out: string; score: { subject: { kind: string; id: string }; combined: number } }
    }
    assert.equal(payload.ok, true)
    assert.equal(payload.command, "assemble")
    assert.equal(payload.data.out, path.join(runDir, "out"))
    const score = JSON.parse(await readFile(path.join(runDir, "out", "score.json"), "utf8")) as {
      subject: { kind: string; id: string }
      combined: number
    }
    assert.equal(score.subject.kind, "page")
    assert.equal(score.subject.id, looped.runId)
    assert.equal(typeof score.combined, "number")
    assert.equal(payload.data.score.combined, score.combined)
    const html = await readFile(path.join(runDir, "out", "index.html"), "utf8")
    assert.equal(html.includes("background-image"), false)
    assert.equal(html.includes("data:image"), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})