import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isTrainerGokuQaTestCommand,
  parseTrainerGokuQaCommand,
  TRAINER_GOKU_QA_COMMAND,
} from "@/lib/landbot/training-guards"

describe("trainer goku qa command", () => {
  it("fires on the bare command with no notes", () => {
    assert.deepEqual(parseTrainerGokuQaCommand(TRAINER_GOKU_QA_COMMAND), { notes: "" })
    assert.deepEqual(parseTrainerGokuQaCommand("  לימוד גוקו  "), { notes: "" })
    assert.deepEqual(parseTrainerGokuQaCommand("לימוד גוקו\n"), { notes: "" })
  })

  it("turns the text after the command into operator notes", () => {
    assert.deepEqual(parseTrainerGokuQaCommand("לימוד גוקו: שים לב לכך שקרה ככה וככה"), {
      notes: "שים לב לכך שקרה ככה וככה",
    })
    assert.deepEqual(parseTrainerGokuQaCommand("לימוד גוקו - הבוט העביר למכירות\nבמקום לשירות"), {
      notes: "הבוט העביר למכירות במקום לשירות",
    })
    assert.deepEqual(parseTrainerGokuQaCommand("לימוד גוקו בבקשה"), { notes: "בבקשה" })
  })

  it("fires when the command is anywhere in the message", () => {
    assert.deepEqual(parseTrainerGokuQaCommand("הבוט שכח את ההזמנה. לימוד גוקו"), {
      notes: "הבוט שכח את ההזמנה.",
    })
  })

  it("ignores unrelated trainer messages", () => {
    assert.equal(isTrainerGokuQaTestCommand("איפוס"), false)
    assert.equal(isTrainerGokuQaTestCommand("לתיקון: תענה קצר יותר"), false)
    assert.equal(parseTrainerGokuQaCommand("שלום"), null)
  })
})
