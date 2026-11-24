import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import zlib from "node:zlib"
import { readRaster } from "./decode.ts"
import { generateProject, runLoop } from "./loop.ts"
import type { IntermediateDescription, ScoreRecord } from "./records.ts"

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

test("loop writes a page from color bands and does not embed the source", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "trace-loop-"))
  const image = path.join(dir, "page.png")
  await writeFile(
    image,
    stripePng(20, [
      { height: 10, rgb: [255, 0, 0] },
      { height: 10, rgb: [255, 255, 255] },
      { height: 10, rgb: [7, 22, 51] },
    ]),
  )
  try {
    const result = await runLoop({ image, outDir: dir, seed: 1 })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.command, "loop")
    assert.equal(result.data.stopReason, "cap")
    const html = await readFile(path.join(dir, "runs", result.runId, "out", "index.html"), "utf8")
    assert.equal(html.includes("page.png"), false)
    assert.equal(html.includes("background-image"), false)
    assert.match(html, /#ff0000/i)
    assert.match(html, /#071633/i)
    const heights = [...html.matchAll(/height:(\d+)px/g)].map((match) => Number(match[1]))
    assert.equal(heights.reduce((sum, height) => sum + height, 0), 30)
    const css = await readFile(path.join(dir, "runs", result.runId, "out", "styles.css"), "utf8")
    assert.match(css, /border-box/)
    const annotations = JSON.parse(
      await readFile(path.join(dir, "runs", result.runId, "annotations.json"), "utf8"),
    ) as { sections: { label: string; bbox: { y: number; height: number } }[] }
    assert.equal(annotations.sections.length, 3)
    assert.equal(annotations.sections[0]?.bbox.y, 0)
    assert.equal(annotations.sections[1]?.bbox.y, 10)
    assert.equal(annotations.sections[2]?.bbox.y, 20)
    assert.deepEqual(
      annotations.sections.map((section) => section.label),
      ["other", "other", "other"],
    )
    const screenshot = path.join(dir, "runs", result.runId, "sections", "sec-01", "pass-1", "screenshot.png")
    const sectionShot = await readRaster(screenshot)
    assert.equal(sectionShot.width, 20)
    assert.equal(sectionShot.height, 10)
    const pageScreenshot = path.join(dir, "runs", result.runId, "out", "screenshot.png")
    const pageShot = await readRaster(pageScreenshot)
    assert.equal(pageShot.width, 20)
    assert.equal(pageShot.height, 30)
    const secIntermediatePath = path.join(dir, "runs", result.runId, "sections", "sec-01", "pass-1", "intermediate.json")
    const secIntermediate = JSON.parse(await readFile(secIntermediatePath, "utf8")) as IntermediateDescription
    assert.equal(secIntermediate.root.style?.background, "colors.0")
    assert.equal(secIntermediate.root.style?.color, "colors.1")
    assert.match(secIntermediate.tokens.colors[0] ?? "", /#ff0000/i)
    const secScreenshotPath = path.join(dir, "runs", result.runId, "sections", "sec-01", "pass-1", "screenshot.png")
    const secScore = JSON.parse(
      await readFile(path.join(dir, "runs", result.runId, "sections", "sec-01", "pass-1", "score.json"), "utf8"),
    ) as ScoreRecord
    const intermediateHash = createHash("sha256").update(await readFile(secIntermediatePath)).digest("hex")
    const screenshotHash = createHash("sha256").update(await readFile(secScreenshotPath)).digest("hex")
    assert.equal(secScore.inputs.intermediateHash, intermediateHash)
    assert.equal(secScore.inputs.screenshotHash, screenshotHash)
    assert.notEqual(secScore.inputs.intermediateHash, createHash("sha256").update(await readFile(image)).digest("hex"))
    assert.equal(result.data.history.length, 4)
    for (const record of result.data.history) {
      assert.equal(typeof record.combined, "number")
      assert.equal(record.subject.kind === "section" || record.subject.kind === "page", true)
    }
    const pageScore = JSON.parse(
      await readFile(path.join(dir, "runs", result.runId, "out", "score.json"), "utf8"),
    ) as { subject: { kind: string; id: string }; components: Record<string, number>; combined: number }
    assert.equal(pageScore.subject.kind, "page")
    assert.equal(pageScore.subject.id, result.runId)
    const mean =
      (pageScore.components.perceptual +
        pageScore.components.layout +
        pageScore.components.text +
        pageScore.components.color) /
      4
    assert.equal(pageScore.combined, mean)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test("short ends are nav and footer and a tall second band is hero", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "trace-labels-"))
  const image = path.join(dir, "page.png")
  await writeFile(
    image,
    stripePng(20, [
      { height: 8, rgb: [10, 20, 40] },
      { height: 40, rgb: [255, 255, 255] },
      { height: 16, rgb: [120, 140, 160] },
      { height: 8, rgb: [7, 22, 51] },
    ]),
  )
  try {
    const result = await runLoop({ image, outDir: dir, seed: 1 })
    const annotations = JSON.parse(
      await readFile(path.join(dir, "runs", result.runId, "annotations.json"), "utf8"),
    ) as { sections: { label: string }[] }
    assert.deepEqual(
      annotations.sections.map((section) => section.label),
      ["nav/header", "hero", "other", "footer"],
    )
    const html = await readFile(path.join(dir, "runs", result.runId, "out", "index.html"), "utf8")
    assert.match(html, /<h2>nav\/header<\/h2>/)
    assert.match(html, /<h2>hero<\/h2>/)
    const intermediate = path.join(dir, "runs", result.runId, "sections", "sec-02", "pass-1", "intermediate.json")
    const description = JSON.parse(await readFile(intermediate, "utf8")) as {
      root: { children: { kind: string; text?: string }[] }
    }
    description.root.children.push({ kind: "control", text: "Come build" } as never)
    const edited = path.join(dir, "edited.json")
    await writeFile(edited, JSON.stringify(description))
    const project = path.join(dir, "project")
    await generateProject(edited, project)
    const generated = await readFile(path.join(project, "index.html"), "utf8")
    assert.match(generated, /<button type="button">Come build<\/button>/)
    assert.equal(generated.includes("background-image"), false)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
