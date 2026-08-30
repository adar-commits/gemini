import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isBranchListQuestion } from "@/lib/agents/branches"
import {
  extractBranchLabelFromReviewRequest,
  isBranchReviewLinkRequest,
  resolveBranchGoogleReview,
  resolveWebsiteGoogleReview,
} from "@/lib/agents/branch-google-reviews"
import { buildBranchReviewLinkReply } from "@/lib/agents/feedback-handling"

const SAGOLA_REQUEST = "אפשר לקבל את הלינק לדירוג סניף סגולה?"
const SAGOLA_REVIEW_INTENT =
  "היי אני רוצה להשאיר חוות דעת על סניף סגולה שירות שקיבלתי שם"

describe("branch google review link requests", () => {
  it("detects direct review-link asks", () => {
    assert.equal(isBranchReviewLinkRequest(SAGOLA_REQUEST), true)
    assert.equal(isBranchReviewLinkRequest(SAGOLA_REVIEW_INTENT), true)
    assert.equal(isBranchReviewLinkRequest("מה כתובת הסניף בנתניה?"), false)
  })

  it("does not misroute review-link asks to branch address list", () => {
    assert.equal(isBranchListQuestion(SAGOLA_REQUEST), false)
    assert.equal(isBranchListQuestion(SAGOLA_REVIEW_INTENT), false)
  })

  it("resolves סגולה to the write-review URL", () => {
    for (const message of [SAGOLA_REQUEST, SAGOLA_REVIEW_INTENT]) {
      const label = extractBranchLabelFromReviewRequest(message)
      assert.ok(label, message)
      const branch = resolveBranchGoogleReview(label!)
      assert.ok(branch?.reviewUrl, message)
      assert.match(branch!.reviewUrl!, /writereview\?placeid=ChIJ6Xt7lYs3HRUR_N7G1sBu6Zk/)
    }
  })

  it("returns the Google write-review link in the reply", () => {
    for (const message of [SAGOLA_REQUEST, SAGOLA_REVIEW_INTENT]) {
      const reply = buildBranchReviewLinkReply(message)
      assert.match(reply, /writereview\?placeid=ChIJ6Xt7lYs3HRUR_N7G1sBu6Zk/, message)
      assert.match(reply, /סגולה/, message)
      assert.doesNotMatch(reply, /הרב פינטו/, message)
    }
  })

  it("uses ראשון לציון link for website / online review asks", () => {
    const website = resolveWebsiteGoogleReview()
    assert.match(website.reviewUrl!, /writereview\?placeid=ChIJD-4TY4SzAhURoWab1AruIns/)
    assert.match(website.displayName, /ראשון/)

    const fromBranch = resolveBranchGoogleReview("אתר", "3000")
    assert.equal(fromBranch?.reviewUrl, website.reviewUrl)

    const reply = buildBranchReviewLinkReply("רוצה לדרג את הרכישה מהאתר")
    assert.match(reply, /writereview\?placeid=ChIJD-4TY4SzAhURoWab1AruIns/)
    assert.match(reply, /ראשון לציון/)
  })
})
