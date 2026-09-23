import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeContentHash,
  extractLiveStamp,
  extractPreserveBlock,
  htmlToText,
  normalizeForHash,
  splitKbSection,
} from "../sync-utils";

describe("kb sync utils", () => {
  it("normalizes oversized rug typography", () => {
    const text = htmlToText("<p>שטיחים 240\\340 ו-300\\400</p>");
    assert.match(text, /240×340/);
    assert.match(text, /300×400/);
  });

  it("extracts Hebrew live stamp", () => {
    const stamp = extractLiveStamp("מדיניות משלוחים\nמעודכן ליום 23.09.26");
    assert.equal(stamp, "23.09.26");
  });

  it("stable hash for normalized content", () => {
    const a = computeContentHash(normalizeForHash("Free  delivery"));
    const b = computeContentHash(normalizeForHash("free delivery"));
    assert.equal(a, b);
  });

  it("splits KB section at next same-level heading", () => {
    const md = "## Shipping policy\nUpdated 29.07.26\n- fact\n## Refund\n- other";
    const split = splitKbSection(md, "## Shipping policy");
    assert.ok(split);
    assert.match(split.section, /Updated 29\.07\.26/);
    assert.match(split.after, /^## Refund/);
  });

  it("extracts preserve block by heading", () => {
    const section = "## Shipping\n- fact\n\n### WhatsApp bot override (operator locked)\n- handoff\n## Next";
    const block = extractPreserveBlock(section, "### WhatsApp bot override (operator locked)");
    assert.ok(block);
    assert.match(block, /human_service|handoff/i);
  });
});
