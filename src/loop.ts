import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { readRaster, writePng, type Raster } from "./decode.ts"
import { recognizeText, type OcrLine } from "./ocr.ts"
import { generateProject, materializeNode, pageHtml, projectCss } from "./reference-adapter.ts"
import type { IntermediateDescription, Mismatch, ScoreRecord } from "./records.ts"
import { renderBuiltPage, renderHtmlPage } from "./render.ts"
import { scoreRasters, sourceEmbedded } from "./score.ts"

const packageRoot = path.resolve(import.meta.dirname, "..")

function runViteBuild(projectDir: string): Promise<void> {
  const viteBin = path.join(packageRoot, "node_modules", "vite", "bin", "vite.js")
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [viteBin, "build"], {
      cwd: projectDir,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stderr = ""
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `vite build exited ${code}`))
    })
  })
}

export { generateProject } from "./reference-adapter.ts"

type Rgb = { r: number; g: number; b: number }

type Band = { y: number; height: number; rgb: Rgb }

export type LoopSuccess = {
  ok: true
  command: "loop"
  schemaVersion: 1
  runId: string
  data: {
    lastOutput: string
    history: ScoreRecord[]
    remainingMismatches: Mismatch[]
    stopReason: "cap" | "threshold"
  }
  warnings: { code: string; message: string }[]
}

const minBand = 8
const cutDistance = 55
const cutStreak = 4
const flatLimit = 14

function rowStat(raster: Raster, y: number): { mean: Rgb; mad: number } {
  const step = Math.max(1, Math.floor(raster.width / 128))
  let r = 0
  let g = 0
  let b = 0
  let count = 0
  const origin = y * raster.width * 4
  const samples: Rgb[] = []
  for (let x = 0; x < raster.width; x += step) {
    const pixel = origin + x * 4
    const sample = {
      r: raster.data[pixel] ?? 0,
      g: raster.data[pixel + 1] ?? 0,
      b: raster.data[pixel + 2] ?? 0,
    }
    samples.push(sample)
    r += sample.r
    g += sample.g
    b += sample.b
    count += 1
  }
  const mean = { r: r / count, g: g / count, b: b / count }
  let mad = 0
  for (const sample of samples) {
    mad += Math.abs(sample.r - mean.r) + Math.abs(sample.g - mean.g) + Math.abs(sample.b - mean.b)
  }
  return { mean, mad: mad / count }
}

function distance(a: Rgb, b: Rgb): number {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function blend(mean: Rgb, sample: Rgb, count: number): Rgb {
  return {
    r: (mean.r * (count - 1) + sample.r) / count,
    g: (mean.g * (count - 1) + sample.g) / count,
    b: (mean.b * (count - 1) + sample.b) / count,
  }
}

function medianChannel(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

function fillColor(stats: { mean: Rgb; mad: number }[], y: number, height: number): Rgb {
  const flats: Rgb[] = []
  let r = 0
  let g = 0
  let b = 0
  for (let row = y; row < y + height; row += 1) {
    const sample = stats[row] ?? { mean: { r: 0, g: 0, b: 0 }, mad: 0 }
    r += sample.mean.r
    g += sample.mean.g
    b += sample.mean.b
    if (sample.mad <= flatLimit) flats.push(sample.mean)
  }
  const span = Math.max(1, height)
  if (flats.length / span >= 0.45) {
    return {
      r: medianChannel(flats.map((sample) => sample.r)),
      g: medianChannel(flats.map((sample) => sample.g)),
      b: medianChannel(flats.map((sample) => sample.b)),
    }
  }
  return { r: r / span, g: g / span, b: b / span }
}

export function colorBands(raster: Raster): Band[] {
  const stats = Array.from({ length: raster.height }, (_, y) => rowStat(raster, y))
  const starts = [0]
  let start = 0
  let mean = stats[0]?.mean ?? { r: 0, g: 0, b: 0 }
  let seen = 1
  const floor = Math.max(minBand, Math.round(stats.length * 0.045))
  let streak = 0
  for (let y = 1; y < stats.length; y += 1) {
    const sample = stats[y] ?? { mean, mad: 0 }
    if (sample.mad > flatLimit) {
      streak = 0
      continue
    }
    if (distance(sample.mean, mean) > cutDistance) streak += 1
    else {
      streak = 0
      seen += 1
      mean = blend(mean, sample.mean, seen)
    }
    if (streak >= cutStreak && y - (cutStreak - 1) - start >= floor) {
      const cut = y - (cutStreak - 1)
      starts.push(cut)
      start = cut
      mean = stats[cut]?.mean ?? sample.mean
      seen = 1
      streak = 0
    }
  }
  return starts.map((y, index) => {
    const next = starts[index + 1] ?? raster.height
    return { y, height: next - y, rgb: fillColor(stats, y, next - y) }
  })
}

function hex(rgb: Rgb): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, "0")
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`
}

function crop(raster: Raster, y: number, height: number): Raster {
  const data = new Uint8Array(raster.width * height * 4)
  const start = y * raster.width * 4
  data.set(raster.data.subarray(start, start + data.length))
  return { width: raster.width, height, data }
}

function overlay(raster: Raster, sections: Band[]): Buffer {
  const data = new Uint8Array(raster.data)
  for (const band of sections) {
    for (let x = 0; x < raster.width; x += 1) {
      for (const y of [band.y, Math.min(raster.height - 1, band.y + band.height - 1)]) {
        const pixel = (y * raster.width + x) * 4
        data[pixel] = 226
        data[pixel + 1] = 59
        data[pixel + 2] = 59
        data[pixel + 3] = 255
      }
    }
  }
  return writePng({ width: raster.width, height: raster.height, data })
}

function ink(rgb: Rgb): string {
  const luma = rgb.r * 0.3 + rgb.g * 0.59 + rgb.b * 0.11
  return luma > 160 ? "#071633" : "#ffffff"
}

function parseHex(value: string): Rgb {
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  }
}

function tenth(value: number): number {
  return Math.round(value * 10) / 10
}

function colorIndex(colors: string[], value: string): number {
  const rgb = parseHex(value)
  for (let index = 0; index < colors.length; index += 1) {
    const current = colors[index]
    if (current && distance(rgb, parseHex(current)) < 18) return index
  }
  colors.push(value)
  return colors.length - 1
}

function fontIndex(fonts: string[], value: string): number {
  const found = fonts.indexOf(value)
  if (found >= 0) return found
  fonts.push(value)
  return fonts.length - 1
}

function textInk(raster: Raster, box: { x: number; y: number; width: number; height: number }, background: Rgb): string {
  const x0 = Math.max(0, Math.floor(box.x))
  const y0 = Math.max(0, Math.floor(box.y))
  const x1 = Math.min(raster.width, Math.ceil(box.x + box.width))
  const y1 = Math.min(raster.height, Math.ceil(box.y + box.height))
  const samples: Rgb[] = []
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const pixel = (y * raster.width + x) * 4
      const sample = {
        r: raster.data[pixel] ?? 0,
        g: raster.data[pixel + 1] ?? 0,
        b: raster.data[pixel + 2] ?? 0,
      }
      if (distance(sample, background) > 45) samples.push(sample)
    }
  }
  if (samples.length < 8) return ink(background)
  const ranked = samples
    .map((sample) => ({ sample, distance: distance(sample, background) }))
    .sort((a, b) => b.distance - a.distance)
  const stem = ranked.slice(0, Math.max(1, Math.ceil(ranked.length * 0.3))).map((item) => item.sample)
  return hex({
    r: medianChannel(stem.map((sample) => sample.r)),
    g: medianChannel(stem.map((sample) => sample.g)),
    b: medianChannel(stem.map((sample) => sample.b)),
  })
}

function sectionLines(lines: OcrLine[], y: number, height: number): OcrLine[] {
  return lines
    .filter((line) => line.confidence >= 0.5 && line.fontSize > 0)
    .filter((line) => {
      const mid = line.y + line.height / 2
      return mid >= y && mid < y + height
    })
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

export function labelFor(index: number, count: number, height: number, pageHeight: number): string {
  const share = height / pageHeight
  if (index === 0 && share <= 0.2) return "nav/header"
  if (index === count - 1 && count > 1 && share <= 0.2) return "footer"
  if (index === 1 && share >= 0.35) return "hero"
  return "other"
}

function describeSection(input: {
  raster: Raster
  lines: OcrLine[]
  ocrMissing: boolean
  sourceHash: string
  section: { id: string; label: string; color: string; ink: string; y: number; height: number; rgb: Rgb }
}): IntermediateDescription {
  const { raster, section } = input
  const colors = [section.color, section.ink]
  const fonts: string[] = []
  const foundLines = sectionLines(input.lines, section.y, section.height)
  const children =
    foundLines.length > 0
      ? foundLines.map((line, index) => {
          const font = `${line.fontWeight} ${tenth(line.fontSize)}px ${line.fontFamily}`
          const inkHex = textInk(raster, line, section.rgb)
          return {
            id: `${section.id}-t${String(index + 1).padStart(2, "0")}`,
            kind: "text" as const,
            text: line.text,
            box: {
              x: tenth(line.left),
              y: tenth(Math.max(0, line.top - section.y)),
              width: tenth(line.width),
              height: tenth(line.height),
            },
            style: { color: `colors.${colorIndex(colors, inkHex)}`, fontFamily: `fonts.${fontIndex(fonts, font)}` },
            children: [],
            guesses: [{ field: "text", reason: "vision ocr", confidence: line.confidence }],
          }
        })
      : [
          {
            id: `${section.id}-label`,
            kind: "text" as const,
            text: section.label,
            box: { x: 0, y: 0, width: raster.width, height: 32 },
            style: { color: "transparent" },
            children: [],
            guesses: [
              {
                field: "text",
                reason: input.ocrMissing ? "vision unavailable" : "position label, not OCR",
                confidence: 0.4,
              },
            ],
          },
        ]
  return {
    schemaVersion: 1,
    sectionId: section.id,
    source: {
      imageHash: input.sourceHash,
      bbox: { x: 0, y: section.y, width: raster.width, height: section.height },
      width: raster.width,
    },
    tokens: { colors, spacing: [], fonts, radii: [] },
    fontSubstitutions: [],
    root: {
      id: section.id,
      kind: "box",
      box: { x: 0, y: 0, width: raster.width, height: section.height },
      style: { background: "colors.0", color: "colors.1" },
      children,
      guesses: [],
    },
  }
}

export async function runLoop(options: {
  image: string
  outDir: string
  seed: number
  passes?: number
  baseline?: number
}): Promise<LoopSuccess> {
  const bytes = await readFile(options.image)
  const raster = await readRaster(options.image)
  const ocr = await recognizeText(options.image)
  const lines = ocr ?? []
  const model =
    ocr && ocr.length > 0 ? { name: "local-vision-ocr", version: "1" } : { name: "local-color-bands", version: "1" }
  const runId = createHash("sha256").update(bytes).digest("hex").slice(0, 12)
  const root = path.join(options.outDir, "runs", runId)
  const found = colorBands(raster)
  const sections = found.map((band, index) => ({
    id: `sec-${String(index + 1).padStart(2, "0")}`,
    label: labelFor(index, found.length, band.height, raster.height),
    color: hex(band.rgb),
    ink: ink(band.rgb),
    ...band,
  }))
  await mkdir(root, { recursive: true })
  const sourceHash = createHash("sha256").update(bytes).digest("hex")
  const annotations = {
    schemaVersion: 1,
    source: { hash: sourceHash, width: raster.width, height: raster.height },
    sections: sections.map((section, index) => ({
      id: section.id,
      bbox: { x: 0, y: section.y, width: raster.width, height: section.height },
      label: section.label,
      confidence: 0.4,
      order: index + 1,
    })),
  }
  await writeFile(path.join(root, "annotations.json"), JSON.stringify(annotations))
  await writeFile(path.join(root, "overlay.png"), overlay(raster, found))
  const history: ScoreRecord[] = []
  const passCap = Math.max(1, options.passes ?? 1)
  const finishedPasses: { id: string; passes: number; status: string }[] = []
  let everySectionCleared = options.baseline !== undefined
  for (const section of sections) {
    const sectionDir = path.join(root, "sections", section.id)
    await mkdir(sectionDir, { recursive: true })
    await writeFile(path.join(sectionDir, "source.png"), writePng(crop(raster, section.y, section.height)))
    let completed = 0
    let cleared = false
    for (let passNumber = 1; passNumber <= passCap; passNumber += 1) {
      const pass = path.join(sectionDir, `pass-${passNumber}`)
      await mkdir(pass, { recursive: true })
    const intermediate = describeSection({
      raster,
      lines,
      ocrMissing: ocr === null,
      sourceHash,
      section,
    })
    const intermediatePath = path.join(pass, "intermediate.json")
    await writeFile(intermediatePath, JSON.stringify(intermediate))
    const projectDir = path.join(pass, "project")
    await generateProject(intermediatePath, projectDir)
    await runViteBuild(projectDir)
    const screenshotPath = path.join(pass, "screenshot.png")
    await renderBuiltPage({
      projectDir,
      width: raster.width,
      out: screenshotPath,
    })
    const projectHtml = await readFile(path.join(projectDir, "index.html"), "utf8")
    const sectionShot = await readRaster(screenshotPath)
    const sectionScore = scoreRasters(crop(raster, section.y, section.height), sectionShot)
    const embedded = sourceEmbedded(projectHtml)
    const score = {
      subject: { kind: "section" as const, id: section.id },
      pass: passNumber,
      components: sectionScore.components,
      combined: sectionScore.combined,
      gates: [
        {
          name: "source-not-embedded",
          passed: !embedded,
          detail: embedded ? "project HTML embeds an image" : "project HTML has no source image",
        },
      ],
      mismatches: sectionScore.mismatches,
      model,
      seed: options.seed,
      scorerVersion: "2",
      inputs: {
        intermediateHash: createHash("sha256").update(await readFile(intermediatePath)).digest("hex"),
        screenshotHash: createHash("sha256").update(await readFile(screenshotPath)).digest("hex"),
      },
    }
    await writeFile(path.join(pass, "score.json"), JSON.stringify(score))
    history.push(score)
    completed = passNumber
    if (options.baseline !== undefined && score.combined > options.baseline) {
      cleared = true
      break
    }
    }
    if (!cleared) everySectionCleared = false
    finishedPasses.push({ id: section.id, passes: completed, status: cleared ? "threshold" : "capped" })
  }
  const outDir = path.join(root, "out")
  await mkdir(outDir, { recursive: true })
  const descriptions = await Promise.all(
    sections.map(async (section) =>
      JSON.parse(
        await readFile(path.join(root, "sections", section.id, "pass-1", "intermediate.json"), "utf8"),
      ) as IntermediateDescription,
    ),
  )
  const trees = descriptions.map((description) => materializeNode(description.root, description.tokens))
  const pageIntermediatePath = path.join(outDir, "intermediate.json")
  const pageIntermediate = {
    schemaVersion: 1,
    sectionId: "page",
    source: {
      imageHash: sourceHash,
      bbox: { x: 0, y: 0, width: raster.width, height: raster.height },
      width: raster.width,
    },
    tokens: { colors: [], spacing: [], fonts: [], radii: [] },
    fontSubstitutions: [],
    root: {
      id: "page",
      kind: "box" as const,
      box: { x: 0, y: 0, width: raster.width, height: raster.height },
      children: descriptions.map((description) => description.root),
      guesses: [],
    },
  }
  await writeFile(pageIntermediatePath, JSON.stringify(pageIntermediate))
  await writeFile(path.join(outDir, "index.html"), pageHtml(raster.width, trees))
  await writeFile(path.join(outDir, "styles.css"), projectCss)
  const pageHtmlPath = path.join(outDir, "index.html")
  const pageScreenshotPath = path.join(outDir, "screenshot.png")
  await renderHtmlPage({
    html: pageHtmlPath,
    width: raster.width,
    out: pageScreenshotPath,
  })
  const pageRasterScore = scoreRasters(raster, await readRaster(pageScreenshotPath))
  const pageEmbedded = sourceEmbedded(await readFile(pageHtmlPath, "utf8"))
  const pageScore = {
    subject: { kind: "page" as const, id: runId },
    pass: 1,
    components: pageRasterScore.components,
    combined: pageRasterScore.combined,
    gates: [
      {
        name: "source-not-embedded",
        passed: !pageEmbedded,
        detail: pageEmbedded ? "project HTML embeds an image" : "project HTML has no source image",
      },
    ],
    mismatches: pageRasterScore.mismatches,
    model,
    seed: options.seed,
    scorerVersion: "2",
    inputs: {
      intermediateHash: createHash("sha256").update(await readFile(pageIntermediatePath)).digest("hex"),
      screenshotHash: createHash("sha256").update(await readFile(pageScreenshotPath)).digest("hex"),
    },
  }
  await writeFile(path.join(outDir, "score.json"), JSON.stringify(pageScore))
  history.push(pageScore)
  await writeFile(
    path.join(root, "manifest.json"),
    JSON.stringify({
      runId,
      input: { path: options.image, hash: sourceHash, width: raster.width, height: raster.height },
      seed: options.seed,
      toolVersion: "0.0.1",
      sections: finishedPasses,
    }),
  )
  return {
    ok: true,
    command: "loop",
    schemaVersion: 1,
    runId,
    data: {
      lastOutput: path.join(outDir, "index.html"),
      history,
      remainingMismatches: pageScore.mismatches,
      stopReason: everySectionCleared ? "threshold" : "cap",
    },
    warnings: [
      ...(options.baseline === undefined
        ? [{ code: "no-baseline", message: "No baseline combined score for this image, so the loop stopped at the pass cap." }]
        : []),
      ...(ocr === null
        ? [{ code: "vision-unavailable", message: "macOS Vision OCR did not run, so position labels were not painted as page text." }]
        : []),
    ],
  }
}

export async function segmentImage(options: { image: string; outDir: string; review?: boolean }) {
  const bytes = await readFile(options.image)
  const raster = await readRaster(options.image)
  const runId = createHash("sha256").update(bytes).digest("hex").slice(0, 12)
  const root = path.join(options.outDir, "runs", runId)
  const found = colorBands(raster)
  const sections = found.map((band, index) => ({
    id: `sec-${String(index + 1).padStart(2, "0")}`,
    label: labelFor(index, found.length, band.height, raster.height),
    ...band,
  }))
  await mkdir(root, { recursive: true })
  const annotations = {
    schemaVersion: 1,
    source: {
      hash: createHash("sha256").update(bytes).digest("hex"),
      width: raster.width,
      height: raster.height,
    },
    sections: sections.map((section, index) => ({
      id: section.id,
      bbox: { x: 0, y: section.y, width: raster.width, height: section.height },
      label: section.label,
      confidence: 0.4,
      order: index + 1,
    })),
  }
  await writeFile(path.join(root, "annotations.json"), JSON.stringify(annotations))
  const overlayPath = path.join(root, "overlay.png")
  await writeFile(overlayPath, overlay(raster, found))
  for (const section of sections) {
    const sectionDir = path.join(root, "sections", section.id)
    await mkdir(sectionDir, { recursive: true })
    await writeFile(path.join(sectionDir, "source.png"), writePng(crop(raster, section.y, section.height)))
  }
  return {
    ok: true as const,
    command: "segment" as const,
    schemaVersion: 1 as const,
    runId,
    data: { annotations, overlay: overlayPath },
    warnings: options.review
      ? [{ code: "review", message: "Review annotations.json and overlay.png before generation." }]
      : [],
  }
}

export async function extractImage(options: { image: string; out: string }) {
  const bytes = await readFile(options.image)
  const raster = await readRaster(options.image)
  const ocr = await recognizeText(options.image)
  const found = colorBands(raster)
  const band = found[0] ?? { y: 0, height: raster.height, rgb: { r: 0, g: 0, b: 0 } }
  const section = {
    id: "sec-01",
    label: labelFor(0, 1, raster.height, raster.height),
    color: hex(band.rgb),
    ink: ink(band.rgb),
    y: 0,
    height: raster.height,
    rgb: band.rgb,
  }
  const intermediate = describeSection({
    raster,
    lines: ocr ?? [],
    ocrMissing: ocr === null,
    sourceHash: createHash("sha256").update(bytes).digest("hex"),
    section,
  })
  await mkdir(path.dirname(options.out), { recursive: true })
  await writeFile(options.out, JSON.stringify(intermediate))
  return {
    ok: true as const,
    command: "extract" as const,
    schemaVersion: 1 as const,
    runId: createHash("sha256").update(bytes).digest("hex").slice(0, 12),
    data: { path: options.out, intermediate },
    warnings: [],
  }
}

export async function assembleRun(runDir: string) {
  const manifest = JSON.parse(await readFile(path.join(runDir, "manifest.json"), "utf8")) as {
    runId: string
    input: { path: string; width: number; height: number }
    seed: number
  }
  const annotations = JSON.parse(await readFile(path.join(runDir, "annotations.json"), "utf8")) as {
    sections: { id: string }[]
  }
  const descriptions = await Promise.all(
    annotations.sections.map(
      async (section) =>
        JSON.parse(
          await readFile(path.join(runDir, "sections", section.id, "pass-1", "intermediate.json"), "utf8"),
        ) as IntermediateDescription,
    ),
  )
  const outDir = path.join(runDir, "out")
  await mkdir(outDir, { recursive: true })
  const trees = descriptions.map((description) => materializeNode(description.root, description.tokens))
  const pageIntermediatePath = path.join(outDir, "intermediate.json")
  await writeFile(
    pageIntermediatePath,
    JSON.stringify({
      schemaVersion: 1,
      sectionId: "page",
      source: {
        imageHash: "",
        bbox: { x: 0, y: 0, width: manifest.input.width, height: manifest.input.height },
        width: manifest.input.width,
      },
      tokens: { colors: [], spacing: [], fonts: [], radii: [] },
      fontSubstitutions: [],
      root: {
        id: "page",
        kind: "box",
        box: { x: 0, y: 0, width: manifest.input.width, height: manifest.input.height },
        children: descriptions.map((description) => description.root),
        guesses: [],
      },
    }),
  )
  const pageHtmlPath = path.join(outDir, "index.html")
  await writeFile(pageHtmlPath, pageHtml(manifest.input.width, trees))
  await writeFile(path.join(outDir, "styles.css"), projectCss)
  const pageScreenshotPath = path.join(outDir, "screenshot.png")
  await renderHtmlPage({ html: pageHtmlPath, width: manifest.input.width, out: pageScreenshotPath })
  const pageRasterScore = scoreRasters(await readRaster(manifest.input.path), await readRaster(pageScreenshotPath))
  const pageEmbedded = sourceEmbedded(await readFile(pageHtmlPath, "utf8"))
  const pageScore = {
    subject: { kind: "page" as const, id: manifest.runId },
    pass: 1,
    components: pageRasterScore.components,
    combined: pageRasterScore.combined,
    gates: [
      {
        name: "source-not-embedded",
        passed: !pageEmbedded,
        detail: pageEmbedded ? "project HTML embeds an image" : "project HTML has no source image",
      },
    ],
    mismatches: pageRasterScore.mismatches,
    model: { name: "local-color-bands", version: "1" },
    seed: manifest.seed,
    scorerVersion: "2",
    inputs: {
      intermediateHash: createHash("sha256").update(await readFile(pageIntermediatePath)).digest("hex"),
      screenshotHash: createHash("sha256").update(await readFile(pageScreenshotPath)).digest("hex"),
    },
  }
  await writeFile(path.join(outDir, "score.json"), JSON.stringify(pageScore))
  return {
    ok: true as const,
    command: "assemble" as const,
    schemaVersion: 1 as const,
    runId: manifest.runId,
    data: { out: outDir, score: pageScore },
    warnings: [],
  }
}
