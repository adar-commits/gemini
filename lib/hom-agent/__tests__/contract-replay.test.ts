import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  CONVERSATION_CONTRACTS,
  replayAllContracts,
  replayContract,
} from "@/lib/hom-agent/contracts"

describe("conversation contract registry", () => {
  it("has at least 25 contracts", () => {
    assert.ok(
      CONVERSATION_CONTRACTS.length >= 25,
      `expected >= 25 contracts, got ${CONVERSATION_CONTRACTS.length}`
    )
  })

  it("uses unique contract ids", () => {
    const ids = CONVERSATION_CONTRACTS.map((contract) => contract.id)
    assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids}`)
  })

  for (const contract of CONVERSATION_CONTRACTS) {
    it(`replays ${contract.id}`, async () => {
      const result = await replayContract(contract)
      if (!result.ok) {
        const details = result.failures
          .map((failure) => `[${failure.assertionIndex}] ${failure.message}`)
          .join("\n")
        assert.fail(`${contract.id} failed:\n${details}`)
      }
    })
  }

  it("replays full registry in batch", async () => {
    const results = await replayAllContracts(CONVERSATION_CONTRACTS)
    const failed = results.filter((result) => !result.ok)
    if (failed.length > 0) {
      const summary = failed
        .map(
          (result) =>
            `${result.contractId}: ${result.failures.map((f) => f.message).join("; ")}`
        )
        .join("\n")
      assert.fail(`${failed.length} contract(s) failed:\n${summary}`)
    }
  })
})
