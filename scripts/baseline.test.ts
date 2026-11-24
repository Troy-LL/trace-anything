import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { dryRun, liveRun } from "./baseline.ts"

const root = path.resolve(import.meta.dirname, "..")

function offlineFetch(): Promise<never> {
  throw new Error("network")
}

test("two dry runs write the same manifest", async () => {
  const outA = await mkdtemp(path.join(tmpdir(), "baseline-a-"))
  const outB = await mkdtemp(path.join(tmpdir(), "baseline-b-"))
  try {
    const a = await dryRun({ root, outDir: outA, fetchImpl: offlineFetch })
    const b = await dryRun({ root, outDir: outB, fetchImpl: offlineFetch })
    assert.equal(a.bytes.toString(), b.bytes.toString())
    const manifest = JSON.parse(a.bytes.toString()) as {
      mode: string
      provider: string
      model: string
      passes: number
      spendCapUsd: number
      ids: string[]
      requests: { id: string; model: string; image?: string }[]
    }
    assert.equal(manifest.mode, "dry-run")
    assert.equal(manifest.model, "composer-2.5")
    assert.equal(manifest.provider, "cursor")
    assert.equal(manifest.passes, 3)
    assert.equal(manifest.spendCapUsd, 10)
    assert.equal(manifest.ids.length, 50)
    assert.equal(manifest.requests.length, 50)
    assert.equal(manifest.requests[0]?.image, undefined)
    assert.deepEqual(manifest.requests.map((request) => request.id), manifest.ids)
  } finally {
    await rm(outA, { recursive: true, force: true })
    await rm(outB, { recursive: true, force: true })
  }
})

test("live run refuses without a key", async () => {
  const result = await liveRun({ root, confirmSpend: 10, env: {}, fetchImpl: offlineFetch })
  assert.equal(result.ok, false)
  assert.match(result.reason, /key/i)
})

test("an OpenAI key does not arm a live run", async () => {
  const result = await liveRun({
    root,
    confirmSpend: 10,
    env: { OPENAI_API_KEY: "test" },
    fetchImpl: offlineFetch,
  })
  assert.equal(result.ok, false)
  assert.match(result.reason, /CURSOR_API_KEY/)
})

test("live run refuses without confirm-spend 10", async () => {
  const result = await liveRun({
    root,
    confirmSpend: 1,
    env: { CURSOR_API_KEY: "cursor_test" },
    fetchImpl: offlineFetch,
  })
  assert.equal(result.ok, false)
  assert.match(result.reason, /confirm/i)
})

test("armed live run does not call the network", async () => {
  let called = false
  const result = await liveRun({
    root,
    confirmSpend: 10,
    env: { CURSOR_API_KEY: "cursor_test" },
    fetchImpl: () => {
      called = true
      throw new Error("network")
    },
  })
  assert.equal(called, false)
  assert.equal(result.ok, false)
})