import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { blocksInactivityRoutine, resolveHumanThreadAssistMode } from "@/lib/landbot/human-takeover"

const NOW = new Date("2026-10-08T12:00:00Z")

/** Replay 532876329 — sticky reopen to a rep from an old visit; the bot answers and must ping/close. */
describe("inactivity routine on human-assigned threads (532876329)", () => {
  it("runs ping + close when the rep has been silent for days (stale)", () => {
    const assist = resolveHumanThreadAssistMode({
      assignedAgentId: 664483,
      humanAgentLastAt: "2026-09-20T09:00:00Z",
      now: NOW,
    })
    assert.equal(assist.mode, "stale")
    assert.equal(blocksInactivityRoutine(assist), false)
  })

  it("stays off while the rep replied recently (fresh)", () => {
    const assist = resolveHumanThreadAssistMode({
      assignedAgentId: 664483,
      humanAgentLastAt: "2026-10-08T11:30:00Z",
      now: NOW,
    })
    assert.equal(assist.mode, "fresh")
    assert.equal(blocksInactivityRoutine(assist), true)
  })

  it("stays off when a rep is assigned but never replied and the assign time is unknown", () => {
    const assist = resolveHumanThreadAssistMode({ assignedAgentId: 664483, now: NOW })
    assert.equal(blocksInactivityRoutine(assist), true)
  })

  it("runs ping + close on a bridge thread the bot is answering (534098184)", () => {
    const assist = resolveHumanThreadAssistMode({
      assignedAgentId: 664483,
      humanAgentLastAt: "2026-10-07T12:00:00Z",
      now: NOW,
    })
    assert.equal(assist.mode, "bridge")
    assert.equal(blocksInactivityRoutine(assist), false)
  })
})

/** Replay 508272038 — CRM kept a rep from Sep 23 who never replied; the bot went silent for good. */
describe("old assignment with no rep reply (508272038)", () => {
  it("ages the thread from the CRM assign time, so the bot answers again", () => {
    const assist = resolveHumanThreadAssistMode({
      assignedAgentId: 346963,
      assignedAt: "2026-09-23T08:00:00Z",
      now: NOW,
    })
    assert.equal(assist.mode, "stale")
    assert.equal(blocksInactivityRoutine(assist), false)
  })

  it("keeps the bot silent right after a fresh assignment", () => {
    const assist = resolveHumanThreadAssistMode({
      assignedAgentId: 346963,
      assignedAt: "2026-10-08T11:45:00Z",
      now: NOW,
    })
    assert.equal(assist.mode, "fresh")
    assert.equal(blocksInactivityRoutine(assist), true)
  })

  it("does not block a bot-owned thread", () => {
    assert.equal(blocksInactivityRoutine({ owned: false, mode: null }), false)
  })
})
