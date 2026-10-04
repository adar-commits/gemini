#!/usr/bin/env python3
"""Deploy the Roomvo daily catalog rebuild workflow to n8n Cloud.

Requires N8N_API_KEY (n8n Cloud → Settings → API).
Optional: N8N_BASE_URL (default https://redcarpet.app.n8n.cloud)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

BASE = os.environ.get("N8N_BASE_URL", "https://redcarpet.app.n8n.cloud").rstrip("/")
API_KEY = os.environ.get("N8N_API_KEY", "")
WORKFLOW_ID = os.environ.get("N8N_ROOMVO_WORKFLOW_ID", "E1qHO9qlgPOcB4ZC")

ROOT = Path(__file__).resolve().parents[1]
BUILDER_PATH = ROOT / "n8n-workflows" / "roomvo-feed-build.js"

SHEET_ID = "1-1Hqtq0iyomItaf7dU4q4JHJgIZ1a0hCKIojVDUdWoE"

DEFAULT_SHOPIFY_CRED = {
    "httpHeaderAuth": {"id": "PdPxrKLtcWZ8NCoQ", "name": "Shopify Red Carpet"}
}
DEFAULT_SHEETS_CRED = {
    "googleSheetsOAuth2Api": {
        "id": "google-sheets-placeholder",
        "name": "Google Sheets account",
    }
}


def api(method: str, path: str, body: dict | None = None) -> dict:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        method=method,
        headers={
            "X-N8N-API-KEY": API_KEY,
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {path} failed ({e.code}): {e.read().decode()}") from e


def load_builder_source() -> str:
    text = BUILDER_PATH.read_text(encoding="utf-8")
    marker = "module.exports"
    idx = text.find(marker)
    if idx == -1:
        raise SystemExit(f"Could not strip exports from {BUILDER_PATH}")
    return text[:idx].strip()


def build_code_node_source() -> str:
    builder = load_builder_source()
    orchestrator = f"""
const SHEET_ID = "{SHEET_ID}";
const SHOPIFY_GRAPHQL = "https://redcarpetil.myshopify.com/admin/api/2025-10/graphql.json";
const PRODUCTS_QUERY = `
  query RoomvoProducts($cursor: String) {{
    products(first: 100, after: $cursor, query: "status:active published_status:published") {{
      pageInfo {{ hasNextPage endCursor }}
      nodes {{
        title
        handle
        variants(first: 100) {{
          nodes {{
            id
            sku
            title
            price
            compareAtPrice
            inventoryQuantity
          }}
        }}
      }}
    }}
  }}
`;

function numericVariantId(gid) {{
  const match = String(gid || "").match(/(\\d+)$/);
  return match ? match[1] : String(gid || "");
}}

async function fetchAllShopifyProducts(helpers) {{
  const products = [];
  let cursor = null;
  let hasNext = true;
  while (hasNext) {{
    const response = await helpers.httpRequestWithAuthentication.call(
      {{ helpers }},
      "httpHeaderAuth",
      {{
        method: "POST",
        url: SHOPIFY_GRAPHQL,
        headers: {{ "Content-Type": "application/json" }},
        body: {{ query: PRODUCTS_QUERY, variables: {{ cursor }} }},
        json: true,
      }},
    );
    const payload = response?.data?.products;
    if (!payload) {{
      throw new Error(`Shopify GraphQL error: ${{JSON.stringify(response?.errors || response)}}`);
    }}
    for (const node of payload.nodes || []) {{
      products.push({{
        title: node.title,
        handle: node.handle,
        variants: (node.variants?.nodes || []).map((variant) => ({{
          id: numericVariantId(variant.id),
          sku: variant.sku || "",
          title: variant.title || "",
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          inventoryQuantity: variant.inventoryQuantity ?? 0,
        }})),
      }});
    }}
    hasNext = Boolean(payload.pageInfo?.hasNextPage);
    cursor = payload.pageInfo?.endCursor || null;
  }}
  return products;
}}

function israelTimestamp() {{
  return new Date().toLocaleString("en-GB", {{
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }});
}}

function buildRunPayload(existingSheetRows, shopifyProducts, previousRowCount) {{
  const result = buildRoomvoFeed({{ existingSheetRows, shopifyProducts }});
  const writeEndRow = result.bodyRows.length + 1;
  const clearRange =
    previousRowCount > writeEndRow
      ? `OsherSheet!A${{writeEndRow + 1}}:S${{previousRowCount}}`
      : "";
  return {{
    sheetId: SHEET_ID,
    bodyRows: result.bodyRows,
    writeRange: `OsherSheet!A2:S${{writeEndRow}}`,
    clearRange,
    logRow: [
      israelTimestamp(),
      String(result.stats.outputDataRows),
      result.newSkusMissingFilters.join(", "),
    ],
    newSkusMissingFilters: result.newSkusMissingFilters,
    stats: result.stats,
  }};
}}

const sheetValues = $input.first().json.values || [];
const shopifyProducts = await fetchAllShopifyProducts(this.helpers);
const payload = buildRunPayload(sheetValues, shopifyProducts, sheetValues.length);
return [{{ json: payload }}];
"""
    return builder + "\n\n" + orchestrator.strip()


def expr(value: str) -> str:
    return f"={value}" if not value.startswith("=") else value


def node(
    *,
    id: str,
    name: str,
    type: str,
    type_version: float,
    position: list[int],
    parameters: dict[str, Any],
    credentials: dict[str, Any] | None = None,
    **extra: Any,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": id,
        "name": name,
        "type": type,
        "typeVersion": type_version,
        "position": position,
        "parameters": parameters,
    }
    if credentials:
        payload["credentials"] = credentials
    payload.update(extra)
    return payload


def build_workflow_nodes(
    code_source: str,
    sheets_cred: dict[str, Any],
    shopify_cred: dict[str, Any],
) -> list[dict[str, Any]]:
    return [
        node(
            id="roomvo-cron",
            name="Daily 23:59 Israel",
            type="n8n-nodes-base.scheduleTrigger",
            type_version=1.2,
            position=[0, 300],
            parameters={
                "rule": {
                    "interval": [
                        {
                            "field": "cronExpression",
                            "expression": "59 23 * * *",
                        }
                    ]
                }
            },
        ),
        node(
            id="roomvo-manual",
            name="Manual Run",
            type="n8n-nodes-base.manualTrigger",
            type_version=1,
            position=[0, 500],
            parameters={},
        ),
        node(
            id="roomvo-read-sheet",
            name="Read OsherSheet",
            type="n8n-nodes-base.httpRequest",
            type_version=4.4,
            position=[240, 400],
            parameters={
                "method": "GET",
                "url": f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/OsherSheet!A:S",
                "authentication": "predefinedCredentialType",
                "nodeCredentialType": "googleSheetsOAuth2Api",
                "options": {},
            },
            credentials=sheets_cred,
        ),
        node(
            id="roomvo-build",
            name="Build Roomvo Feed",
            type="n8n-nodes-base.code",
            type_version=2,
            position=[480, 400],
            parameters={"mode": "runOnceForAllItems", "jsCode": code_source},
            credentials=shopify_cred,
        ),
        node(
            id="roomvo-write",
            name="Write OsherSheet Body",
            type="n8n-nodes-base.httpRequest",
            type_version=4.4,
            position=[720, 400],
            parameters={
                "method": "PUT",
                "url": expr(
                    "{{ 'https://sheets.googleapis.com/v4/spreadsheets/' + $json.sheetId + '/values/' + encodeURIComponent($json.writeRange) + '?valueInputOption=USER_ENTERED' }}"
                ),
                "authentication": "predefinedCredentialType",
                "nodeCredentialType": "googleSheetsOAuth2Api",
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": expr("{{ { values: $json.bodyRows } }}"),
                "options": {},
            },
            credentials=sheets_cred,
        ),
        node(
            id="roomvo-if-clear",
            name="Has Leftover Rows?",
            type="n8n-nodes-base.if",
            type_version=2.2,
            position=[960, 400],
            parameters={
                "conditions": {
                    "options": {
                        "caseSensitive": True,
                        "leftValue": "",
                        "typeValidation": "strict",
                    },
                    "conditions": [
                        {
                            "id": "clear-range",
                            "leftValue": expr("{{ $('Build Roomvo Feed').item.json.clearRange }}"),
                            "rightValue": "",
                            "operator": {"type": "string", "operation": "notEmpty"},
                        }
                    ],
                    "combinator": "and",
                }
            },
        ),
        node(
            id="roomvo-clear",
            name="Clear Leftover Rows",
            type="n8n-nodes-base.httpRequest",
            type_version=4.4,
            position=[1200, 300],
            parameters={
                "method": "POST",
                "url": expr(
                    "{{ 'https://sheets.googleapis.com/v4/spreadsheets/' + $('Build Roomvo Feed').item.json.sheetId + '/values/' + encodeURIComponent($('Build Roomvo Feed').item.json.clearRange) + ':clear' }}"
                ),
                "authentication": "predefinedCredentialType",
                "nodeCredentialType": "googleSheetsOAuth2Api",
                "options": {},
            },
            credentials=sheets_cred,
        ),
        node(
            id="roomvo-log",
            name="Append Log Row",
            type="n8n-nodes-base.googleSheets",
            type_version=4.7,
            position=[1200, 520],
            parameters={
                "operation": "append",
                "documentId": {
                    "__rl": True,
                    "mode": "id",
                    "value": SHEET_ID,
                },
                "sheetName": {
                    "__rl": True,
                    "mode": "name",
                    "value": "Log",
                },
                "columns": {
                    "mappingMode": "defineBelow",
                    "value": {
                        "Date": expr("{{ $('Build Roomvo Feed').item.json.logRow[0] }}"),
                        "RowsCreated": expr(
                            "{{ $('Build Roomvo Feed').item.json.logRow[1] }}"
                        ),
                        "NewSkusMissingFilters": expr(
                            "{{ $('Build Roomvo Feed').item.json.logRow[2] }}"
                        ),
                    },
                },
                "options": {},
            },
            credentials=sheets_cred,
        ),
    ]


def build_connections() -> dict[str, Any]:
    return {
        "Daily 23:59 Israel": {
            "main": [[{"node": "Read OsherSheet", "type": "main", "index": 0}]]
        },
        "Manual Run": {
            "main": [[{"node": "Read OsherSheet", "type": "main", "index": 0}]]
        },
        "Read OsherSheet": {
            "main": [[{"node": "Build Roomvo Feed", "type": "main", "index": 0}]]
        },
        "Build Roomvo Feed": {
            "main": [[{"node": "Write OsherSheet Body", "type": "main", "index": 0}]]
        },
        "Write OsherSheet Body": {
            "main": [[{"node": "Has Leftover Rows?", "type": "main", "index": 0}]]
        },
        "Has Leftover Rows?": {
            "main": [
                [{"node": "Clear Leftover Rows", "type": "main", "index": 0}],
                [{"node": "Append Log Row", "type": "main", "index": 0}],
            ]
        },
        "Clear Leftover Rows": {
            "main": [[{"node": "Append Log Row", "type": "main", "index": 0}]]
        },
    }


def pick_credentials(existing: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    sheets_cred = DEFAULT_SHEETS_CRED.copy()
    shopify_cred = DEFAULT_SHOPIFY_CRED.copy()

    for existing_node in existing.get("nodes", []):
        creds = existing_node.get("credentials") or {}
        if "googleSheetsOAuth2Api" in creds:
            sheets_cred = {"googleSheetsOAuth2Api": creds["googleSheetsOAuth2Api"]}
        if "httpHeaderAuth" in creds:
            name = (existing_node.get("name") or "").lower()
            url = json.dumps(existing_node.get("parameters") or {}).lower()
            if "shopify" in name or "shopify" in url or "redcarpetil" in url:
                shopify_cred = {"httpHeaderAuth": creds["httpHeaderAuth"]}

    return sheets_cred, shopify_cred


def main() -> None:
    if not API_KEY:
        print(
            "Set N8N_API_KEY (n8n Cloud → Settings → API → Create API Key), then re-run.",
            file=sys.stderr,
        )
        sys.exit(1)

    code_source = build_code_node_source()
    existing = api("GET", f"/api/v1/workflows/{WORKFLOW_ID}")
    sheets_cred, shopify_cred = pick_credentials(existing)

    nodes = build_workflow_nodes(code_source, sheets_cred, shopify_cred)
    connections = build_connections()

    payload = {
        "name": existing.get("name") or "Roomvo Daily Feed Rebuild",
        "nodes": nodes,
        "connections": connections,
        "settings": {
            **(existing.get("settings") or {}),
            "timezone": "Asia/Jerusalem",
            "executionOrder": "v1",
        },
        "staticData": existing.get("staticData"),
    }

    updated = api("PUT", f"/api/v1/workflows/{WORKFLOW_ID}", payload)
    api("POST", f"/api/v1/workflows/{WORKFLOW_ID}/activate")

    print(
        f"Deployed Roomvo feed workflow {updated.get('name')} ({WORKFLOW_ID}) "
        f"with {len(nodes)} nodes; active=true"
    )


if __name__ == "__main__":
    main()
