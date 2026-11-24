import { spawn } from "node:child_process"
import { mkdir, stat } from "node:fs/promises"
import path from "node:path"

export type OcrLine = {
  text: string
  x: number
  y: number
  width: number
  height: number
  confidence: number
  fontFamily: string
  fontWeight: number
  fontSize: number
  top: number
  left: number
}

const packageRoot = path.resolve(import.meta.dirname, "..")
const scriptPath = path.join(packageRoot, "scripts", "vision-ocr.swift")
const binaryPath = path.join(packageRoot, "node_modules", ".cache", "trace-vision-ocr")

type RunResult = { code: number; stdout: string; stderr: string }

function run(command: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("exit", (code) => {
      resolve({ code: code ?? 1, stdout, stderr })
    })
  })
}

let compiling: Promise<string | null> | undefined

async function visionBinary(): Promise<string | null> {
  if (!compiling) compiling = compileVisionBinary()
  return compiling
}

async function compileVisionBinary(): Promise<string | null> {
  const scriptStat = await stat(scriptPath).catch(() => null)
  if (!scriptStat) return null
  const binaryStat = await stat(binaryPath).catch(() => null)
  if (binaryStat && binaryStat.mtimeMs >= scriptStat.mtimeMs) return binaryPath
  const swiftc = await run("/usr/bin/swiftc", ["-O", "-o", binaryPath, scriptPath]).catch(() => null)
  if (!swiftc || swiftc.code !== 0) return null
  const compiled = await stat(binaryPath).catch(() => null)
  return compiled ? binaryPath : null
}

export async function recognizeText(imagePath: string): Promise<OcrLine[] | null> {
  await mkdir(path.dirname(binaryPath), { recursive: true }).catch(() => undefined)
  const binary = await visionBinary()
  if (!binary) return null
  const result = await run(binary, [imagePath]).catch(() => null)
  if (!result || result.code !== 0) return null
  try {
    const parsed = JSON.parse(result.stdout) as OcrLine[]
    if (!Array.isArray(parsed)) return null
    return parsed.filter((line) => typeof line.text === "string" && line.text.length > 0)
  } catch {
    return null
  }
}
