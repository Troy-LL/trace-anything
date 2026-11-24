import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readRaster } from "./decode.ts"
import { assembleRun, extractImage, generateProject, runLoop, segmentImage } from "./loop.ts"
import { renderBuiltPage } from "./render.ts"
import { scoreRasters, sourceEmbedded } from "./score.ts"

function flag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name)
  return index >= 0 ? argv[index + 1] : undefined
}

const argv = process.argv.slice(2)
const command = argv[0]
const image = flag(argv, "--image")
const outDir = flag(argv, "--out") ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

if (command === "generate") {
  const intermediate = flag(argv, "--intermediate")
  const projectOut = flag(argv, "--out")
  if (intermediate === undefined || projectOut === undefined) {
    console.error(
      JSON.stringify({
        ok: false,
        command: "generate",
        error: { code: "usage", message: "trace generate --intermediate <file> --out <dir>", retryable: false },
      }),
    )
    process.exit(1)
  }
  const intermediateBytes = await readFile(intermediate)
  const runId = createHash("sha256").update(intermediateBytes).digest("hex").slice(0, 12)
  await generateProject(intermediate, projectOut)
  console.log(
    JSON.stringify({
      ok: true,
      command: "generate",
      schemaVersion: 1,
      runId,
      data: { project: projectOut },
      warnings: [],
    }),
  )
  process.exit(0)
}

if (command === "render") {
  const projectDir = flag(argv, "--project")
  const widthFlag = flag(argv, "--width")
  const screenshotOut = flag(argv, "--out")
  if (projectDir === undefined || widthFlag === undefined || screenshotOut === undefined) {
    console.error(
      JSON.stringify({
        ok: false,
        command: "render",
        error: { code: "usage", message: "trace render --project <dir> --width <px> --out <png>", retryable: false },
      }),
    )
    process.exit(1)
  }
  const width = Number(widthFlag)
  if (!Number.isInteger(width) || width <= 0) {
    console.error(
      JSON.stringify({
        ok: false,
        command: "render",
        error: { code: "usage", message: "trace render --project <dir> --width <px> --out <png>", retryable: false },
      }),
    )
    process.exit(1)
  }
  const screenshot = await renderBuiltPage({ projectDir, width, out: screenshotOut })
  const runId = createHash("sha256")
    .update(await readFile(path.join(projectDir, "index.html")))
    .digest("hex")
    .slice(0, 12)
  console.log(
    JSON.stringify({ ok: true, command: "render", schemaVersion: 1, runId, data: { screenshot }, warnings: [] }),
  )
  process.exit(0)
}

if (command === "score") {
  const source = flag(argv, "--source")
  const screenshot = flag(argv, "--screenshot")
  const htmlPath = flag(argv, "--html")
  if (source === undefined || screenshot === undefined) {
    console.error(
      JSON.stringify({
        ok: false,
        command: "score",
        error: {
          code: "usage",
          message: "trace score --source <png> --screenshot <png> [--html <file>]",
          retryable: false,
        },
      }),
    )
    process.exit(1)
  }
  const html = htmlPath === undefined ? "" : await readFile(htmlPath, "utf8")
  const embedded = htmlPath !== undefined && sourceEmbedded(html)
  const rasterScore = scoreRasters(await readRaster(source), await readRaster(screenshot))
  const runId = createHash("sha256")
    .update(await readFile(screenshot))
    .digest("hex")
    .slice(0, 12)
  console.log(
    JSON.stringify({
      ok: true,
      command: "score",
      schemaVersion: 1,
      runId,
      data: {
        subject: { kind: "section", id: runId },
        pass: 1,
        components: rasterScore.components,
        combined: rasterScore.combined,
        gates: [
          {
            name: "source-not-embedded",
            passed: !embedded,
            detail:
              htmlPath === undefined
                ? "html not provided"
                : embedded
                  ? "project HTML embeds an image"
                  : "project HTML has no source image",
          },
        ],
        mismatches: rasterScore.mismatches,
        model: { name: "local-raster", version: "1" },
        seed: 1,
        scorerVersion: "2",
        inputs: {
          intermediateHash: "",
          screenshotHash: createHash("sha256").update(await readFile(screenshot)).digest("hex"),
        },
      },
      warnings: [],
    }),
  )
  process.exit(0)
}

if (command === "segment") {
  if (image === undefined) {
    console.error(
      JSON.stringify({
        ok: false,
        command: "segment",
        error: { code: "usage", message: "trace segment --image <file> [--out <dir>] [--review]", retryable: false },
      }),
    )
    process.exit(1)
  }
  const result = await segmentImage({ image, outDir, review: argv.includes("--review") })
  console.log(JSON.stringify(result))
  process.exit(0)
}

if (command === "extract") {
  const extractOut = flag(argv, "--out")
  if (image === undefined || extractOut === undefined) {
    console.error(
      JSON.stringify({
        ok: false,
        command: "extract",
        error: { code: "usage", message: "trace extract --image <file> --out <intermediate.json>", retryable: false },
      }),
    )
    process.exit(1)
  }
  const result = await extractImage({ image, out: extractOut })
  console.log(JSON.stringify(result))
  process.exit(0)
}

if (command === "assemble") {
  const runDir = flag(argv, "--run")
  if (runDir === undefined) {
    console.error(
      JSON.stringify({
        ok: false,
        command: "assemble",
        error: { code: "usage", message: "trace assemble --run <runs/id dir>", retryable: false },
      }),
    )
    process.exit(1)
  }
  const result = await assembleRun(runDir)
  console.log(JSON.stringify(result))
  process.exit(0)
}

if (command !== "loop" || image === undefined) {
  console.error(
    JSON.stringify({
      ok: false,
      command: command ?? "loop",
      error: { code: "usage", message: "trace loop --image <file> [--out <dir>]", retryable: false },
    }),
  )
  process.exit(1)
}

const passesFlag = flag(argv, "--passes")
const baselineFlag = flag(argv, "--baseline")
const passes = passesFlag === undefined ? undefined : Number(passesFlag)
const baseline = baselineFlag === undefined ? undefined : Number(baselineFlag)
const result = await runLoop({
  image,
  outDir,
  seed: 1,
  ...(passes === undefined ? {} : { passes }),
  ...(baseline === undefined ? {} : { baseline }),
})
console.log(JSON.stringify(result))
