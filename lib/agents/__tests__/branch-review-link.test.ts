import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isBranchListQuestion } from "@/lib/agents/branches"
import {
  extractBranchLabelFromReviewRequest,
  isBranchReviewLinkRequest,
  resolveBranchGoogleReview,
} from "@/lib/agents/branch-google-reviews"
import { buildBranchReviewLinkReply } from "@/lib/agents/feedback-handling"

const SAGOLA_REQUEST = "אפשר לקבל את הלינק לדירוג סניף סגולה?"

describe("branch google review link requests", () => {
  it("detects direct review-link asks", () => {
    assert.equal(isBranchReviewLinkRequest(SAGOLA_REQUEST), true)
    assert.equal(isBranchReviewLinkRequest("מה כתובת הסניף בנתניה?"), false)
  })

  it("does not misroute review-link asks to branch address list", () => {
    assert.equal(isBranchListQuestion(SAGOLA_REQUEST), false)
  })

  it("resolves סגולה to the write-review URL", () => {
    const label = extractBranchLabelFromReviewRequest(SAGOLA_REQUEST)
    assert.ok(label)
    const branch = resolveBranchGoogleReview(label!)
    assert.ok(branch?.reviewUrl)
    assert.match(branch!.reviewUrl!, /writereview\?placeid=ChIJ6Xt7lYs3HRUR_N7G1sBu6Zk/)
  })

  it("returns the Google write-review link in the reply", () => {
    const reply = buildBranchReviewLinkReply(SAGOLA_REQUEST)
    assert.match(reply, /writereview\?placeid=ChIJ6Xt7lYs3HRUR_N7G1sBu6Zk/)
    assert.match(reply, /סגולה/)
    assert.doesNotMatch(reply, /הרב פינטו/)
  })
})
