import assert from "node:assert/strict"
import test from "node:test"
import {
  SECTION_LABELS,
  type Annotations,
  type CliResultSuccess,
  type IntermediateDescription,
  type ScoreRecord,
} from "./records.ts"

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

test("shared records survive JSON round-trip", () => {
  const annotations: Annotations = {
    schemaVersion: 1,
    source: { hash: "deadbeef", width: 320, height: 480 },
    sections: [
      {
        id: "sec-01",
        bbox: { x: 0, y: 0, width: 320, height: 120 },
        label: "nav/header",
        confidence: 0.85,
        order: 1,
      },
      {
        id: "sec-02",
        bbox: { x: 0, y: 120, width: 320, height: 240 },
        label: "hero",
        confidence: 0.72,
        order: 2,
      },
    ],
  }
  assert.ok(SECTION_LABELS.includes(annotations.sections[0]!.label))
  assert.deepEqual(roundTrip(annotations), annotations)

  const intermediate: IntermediateDescription = {
    schemaVersion: 1,
    sectionId: "sec-02",
    source: {
      imageHash: "deadbeef",
      bbox: { x: 0, y: 120, width: 320, height: 240 },
      width: 320,
    },
    tokens: {
      colors: ["#ff0000"],
      spacing: [8, 16],
      fonts: ["sans-serif"],
      radii: [4],
    },
    fontSubstitutions: [{ requested: "Inter", used: "sans-serif" }],
    root: {
      id: "sec-02",
      kind: "box",
      box: { x: 0, y: 0, width: 320, height: 240 },
      style: { background: "colors.0", color: "colors.1" },
      children: [
        {
          id: "sec-02-label",
          kind: "text",
          box: { x: 0, y: 0, width: 320, height: 32 },
          text: "hero",
          children: [],
          guesses: [{ field: "text", reason: "label band", confidence: 0.4 }],
        },
      ],
      guesses: [],
    },
  }
  assert.deepEqual(roundTrip(intermediate), intermediate)

  const score: ScoreRecord = {
    subject: { kind: "section", id: "sec-02" },
    pass: 1,
    components: { perceptual: 0.8, layout: 0.9, text: 0.7, color: 0.85 },
    combined: 0.8125,
    gates: [{ name: "contrast", passed: true, detail: "AA on body text" }],
    mismatches: [
      {
        bbox: { x: 4, y: 8, width: 40, height: 12 },
        nodeId: "sec-02-label",
        component: "text",
        severity: "low",
        detail: "OCR delta",
      },
    ],
    model: { name: "local-color-bands", version: "0" },
    seed: 1,
    scorerVersion: "0",
    inputs: { intermediateHash: "aa", screenshotHash: "bb" },
  }
  assert.deepEqual(roundTrip(score), score)

  const cli: CliResultSuccess = {
    ok: true,
    command: "loop",
    schemaVersion: 1,
    runId: "cafebabe1234",
    data: {
      lastOutput: "/tmp/out/index.html",
      history: [score],
      remainingMismatches: [],
      stopReason: "threshold",
    },
    warnings: [{ code: "noop", message: "none" }],
  }
  assert.deepEqual(roundTrip(cli), cli)
})