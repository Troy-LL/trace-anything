import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { IntermediateNode } from "./records.ts"

type RenderNode = IntermediateNode & { style?: { background?: string; color?: string; fontFamily?: string } }

type ColorTokens = { colors: string[]; fonts?: string[] }

function resolveColorToken(value: string, tokens: ColorTokens): string {
  const match = /^colors\.(\d+)$/.exec(value)
  if (match) return tokens.colors[Number(match[1])] ?? value
  return value
}

function resolveFontToken(value: string, tokens: ColorTokens): string {
  const match = /^fonts\.(\d+)$/.exec(value)
  if (match) return tokens.fonts?.[Number(match[1])] ?? value
  return value
}

export function materializeNode(node: IntermediateNode, tokens: ColorTokens): RenderNode {
  const style = node.style
    ? {
        ...node.style,
        ...(node.style.background
          ? { background: resolveColorToken(node.style.background, tokens) }
          : {}),
        ...(node.style.color ? { color: resolveColorToken(node.style.color, tokens) } : {}),
        ...(node.style.fontFamily
          ? { fontFamily: resolveFontToken(node.style.fontFamily, tokens) }
          : {}),
      }
    : undefined
  return {
    ...node,
    style,
    children: node.children.map((child) => materializeNode(child, tokens)),
  }
}

function escapeText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

function fontDeclaration(node: RenderNode, tokens: ColorTokens | undefined): string {
  const raw = node.style?.fontFamily
  if (!raw) return ""
  const value = tokens ? resolveFontToken(raw, tokens) : raw
  const match = /^(\d+)\s+(\d+(?:\.\d+)?)px\s+(.+)$/.exec(value)
  if (!match) return ""
  return `font-weight:${match[1]};font-size:${match[2]}px;font-family:'${match[3]}';`
}

function renderNode(node: RenderNode, tokens: ColorTokens | undefined, nested: boolean): string {
  const text = escapeText(node.text ?? "")
  switch (node.kind) {
    case "text":
      return text.length > 0 ? place(node, `<h2>${text}</h2>`, tokens) : ""
    case "link":
      return place(node, `<a href="#">${text}</a>`, tokens)
    case "control":
      return place(node, `<button type="button">${text}</button>`, tokens)
    case "image":
      return ""
    case "box": {
      const inner = node.children.map((child) => renderNode(child as RenderNode, tokens, true)).join("")
      const rawBackground = node.style?.background ?? "transparent"
      const rawColor = node.style?.color ?? "#071633"
      const background = tokens ? resolveColorToken(rawBackground, tokens) : rawBackground
      const color = tokens ? resolveColorToken(rawColor, tokens) : rawColor
      const position = nested
        ? `position:absolute;left:${node.box.x}px;top:${node.box.y}px;width:${node.box.width}px;`
        : "position:relative;"
      const tag = nested ? "div" : "section"
      return `<${tag} id="${node.id}" style="${position}height:${node.box.height}px;background:${background};color:${color}">${inner}</${tag}>`
    }
    default: {
      const neverKind: never = node.kind
      return neverKind
    }
  }
}

function place(node: RenderNode, inner: string, tokens?: ColorTokens): string {
  if (node.box === undefined) return inner
  const fitted = fontDeclaration(node, tokens)
  const font = fitted || `font-size:${Math.max(8, Math.round(node.box.height * 0.72))}px;`
  const rawColor = node.style?.color
  const color = rawColor ? resolveColorToken(rawColor, tokens ?? { colors: [] }) : ""
  const colorCss = color ? `color:${color};` : ""
  return `<div style="position:absolute;left:${node.box.x}px;top:${node.box.y}px;line-height:1;white-space:nowrap;${font}${colorCss}">${inner}</div>`
}

export function pageHtml(width: number, nodes: RenderNode[], tokens?: ColorTokens): string {
  const blocks = nodes.map((node) => renderNode(node, tokens, false)).join("")
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>trace</title><link rel="stylesheet" href="./styles.css"></head><body style="width:${width}px">${blocks}</body></html>`
}

function projectIndexHtml(width: number, nodes: RenderNode[], tokens: ColorTokens): string {
  const blocks = nodes.map((node) => renderNode(node, tokens, false)).join("")
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>trace</title><link rel="stylesheet" href="/styles.css"></head><body style="width:${width}px">${blocks}<script type="module" src="/main.ts"></script></body></html>`
}

export const projectCss =
  "body{margin:0}section,section div{box-sizing:border-box}section{position:relative;overflow:hidden;font:16px Arial,Helvetica,sans-serif}h2,a,button{margin:0;font:inherit;font-weight:inherit;line-height:1;color:inherit;background:transparent;border:0;padding:0;text-align:left;white-space:nowrap}"

const viteConfig = `export default {
  base: "./",
  build: {
    outDir: "dist",
  },
}
`

const tsconfig = JSON.stringify(
  {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      noEmit: true,
    },
    include: ["*.ts"],
  },
  null,
  2,
)

type IntermediateFile = {
  schemaVersion: number
  sectionId: string
  source: { width: number }
  tokens: ColorTokens
  root: IntermediateNode
}

export async function writeReferenceProject(intermediatePath: string, projectDir: string): Promise<void> {
  const description = JSON.parse(await readFile(intermediatePath, "utf8")) as IntermediateFile
  await mkdir(projectDir, { recursive: true })
  await writeFile(
    path.join(projectDir, "index.html"),
    projectIndexHtml(description.source.width, [description.root], description.tokens),
  )
  await writeFile(path.join(projectDir, "styles.css"), projectCss)
  await writeFile(path.join(projectDir, "main.ts"), `export const sectionId = ${JSON.stringify(description.sectionId)}\n`)
  await writeFile(
    path.join(projectDir, "package.json"),
    `${JSON.stringify(
      {
        name: "trace-section",
        private: true,
        type: "module",
        scripts: { build: "vite build" },
        devDependencies: { vite: "^6.2.0" },
      },
      null,
      2,
    )}\n`,
  )
  await writeFile(path.join(projectDir, "vite.config.mjs"), viteConfig)
  await writeFile(path.join(projectDir, "tsconfig.json"), tsconfig)
}

export async function generateProject(intermediatePath: string, projectDir: string): Promise<void> {
  await writeReferenceProject(intermediatePath, projectDir)
}