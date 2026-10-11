import { after, NextResponse } from "next/server"
import { fixAddress } from "@/lib/address-fixer"
import { logAddressFix } from "@/lib/address-fixer/log"
import { readAddressFixerInput } from "@/lib/address-fixer/request"
import { snapshotInfo } from "@/lib/address-fixer/street-index"

export const runtime = "nodejs"
export const maxDuration = 30

/** Fails closed: without ADDRESS_FIXER_API_KEY configured, nobody is authorized. */
function isAddressFixerAuthorized(request: Request) {
  const expected = process.env.ADDRESS_FIXER_API_KEY?.trim()
  if (!expected) return false
  const provided =
    request.headers.get("x-api-key")?.trim() ??
    request.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim()
  return provided === expected
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
}

export async function GET(request: Request) {
  if (!isAddressFixerAuthorized(request)) return unauthorized()
  const url = new URL(request.url)
  if (!url.searchParams.has("city") && !url.searchParams.has("full_street")) {
    return NextResponse.json({
      ok: true,
      usage: "POST JSON { city, full_street, apartment_floor? } with x-api-key header",
      snapshot: snapshotInfo(),
    })
  }
  return handle(request)
}

export async function POST(request: Request) {
  if (!isAddressFixerAuthorized(request)) return unauthorized()
  return handle(request)
}

async function handle(request: Request) {
  const { input, parse } = await readAddressFixerInput(request)
  if (!input.city && !input.full_street) {
    return NextResponse.json(
      { ok: false, error: "Provide at least one of: city, full_street" },
      { status: 400 }
    )
  }

  const output = await fixAddress(input)
  if (parse === "json_repaired") output.notes.push("request_json_repaired")

  after(() => logAddressFix(output))
  return NextResponse.json(output, {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}
