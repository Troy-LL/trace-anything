export const SECTION_LABELS = [
  "nav/header",
  "hero",
  "features",
  "testimonials",
  "pricing",
  "CTA",
  "footer",
  "other",
] as const

export type SectionLabel = (typeof SECTION_LABELS)[number]

export const NODE_KINDS = ["box", "text", "image", "link", "control"] as const

export type NodeKind = (typeof NODE_KINDS)[number]

export type Bbox = { x: number; y: number; width: number; height: number }

export type Annotations = {
  schemaVersion: number
  source: { hash: string; width: number; height: number }
  sections: {
    id: string
    bbox: Bbox
    label: SectionLabel
    confidence: number
    order: number
  }[]
}

export type IntermediateDescription = {
  schemaVersion: number
  sectionId: string
  source: { imageHash: string; bbox: Bbox; width: number }
  tokens: { colors: string[]; spacing: number[]; fonts: string[]; radii: number[] }
  fontSubstitutions: { requested: string; used: string }[]
  root: IntermediateNode
}

export type IntermediateNode = {
  id: string
  kind: NodeKind
  box: Bbox
  text?: string
  style?: Record<string, string>
  children: IntermediateNode[]
  guesses?: { field: string; reason: string; confidence: number }[]
}

export type ScoreComponentName = "perceptual" | "layout" | "text" | "color"

export type ScoreRecord = {
  subject: { kind: "section" | "page"; id: string }
  pass: number
  components: Record<ScoreComponentName, number>
  combined: number
  gates: { name: string; passed: boolean; detail: string }[]
  mismatches: Mismatch[]
  model: { name: string; version: string }
  seed: number
  scorerVersion: string
  inputs: { intermediateHash: string; screenshotHash: string }
}

export type Mismatch = {
  bbox: Bbox
  nodeId?: string
  component?: ScoreComponentName
  severity: "low" | "high"
  detail: string
}

export type CliWarning = { code: string; message: string }

export type CliResultSuccess<TData = unknown> = {
  ok: true
  command: string
  schemaVersion: number
  runId: string
  data: TData
  warnings: CliWarning[]
}

export type CliResultFailure = {
  ok: false
  command: string
  error: { code: string; message: string; retryable: boolean; details?: unknown }
}

export type CliResult<TData = unknown> = CliResultSuccess<TData> | CliResultFailure

export type LoopCliData = {
  lastOutput: string
  history: ScoreRecord[]
  remainingMismatches: Mismatch[]
  stopReason: "threshold" | "cap"
}

export type RunManifest = {
  runId: string
  input: { path: string; hash: string; width: number; height: number }
  seed: number
  toolVersion: string
  sections: { id: string; status: string; passes: number }[]
}