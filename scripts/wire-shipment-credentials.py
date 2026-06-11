#!/usr/bin/env python3
"""Attach n8n credentials to Shipment Status workflow HTTP nodes via REST API.

Requires N8N_API_KEY (n8n Cloud → Settings → API).
Optional: N8N_BASE_URL (default https://redcarpet.app.n8n.cloud)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("N8N_BASE_URL", "https://redcarpet.app.n8n.cloud").rstrip("/")
API_KEY = os.environ.get("N8N_API_KEY", "")

PART1_ID = os.environ.get("N8N_PART1_WORKFLOW_ID", "oKC4oqjIsEUIFx9x")
PART2_ID = os.environ.get("N8N_PART2_WORKFLOW_ID", "f2QJ3Gj47tB3JTA8")

PRIORITY = {"httpBasicAuth": {"id": "XWHbq0ubZuDeRcDp", "name": "Carpetshop's Priority API"}}
SHOPIFY_MP = {"httpHeaderAuth": {"id": "I7KUKOeQTRwWCj9d", "name": "Shopify Marketplaces"}}
SHOPIFY_RC = {"httpHeaderAuth": {"id": "PdPxrKLtcWZ8NCoQ", "name": "Shopify Red Carpet"}}
TERMINAL_X = {"httpHeaderAuth": {"id": "ndHFodPPsWly8IP3", "name": "Terminal X"}}

PART2_CREDS = {
    "Update Tracking Metafield": SHOPIFY_MP,
    "Get Marketplace Fulfillment Order": SHOPIFY_MP,
    "Get Terminal X Metafields": SHOPIFY_MP,
    "Create Marketplace Fulfillment": SHOPIFY_MP,
    "Lookup Regular Shopify Order": SHOPIFY_RC,
    "Create Regular Fulfillment": SHOPIFY_RC,
    "TX Order Packed": TERMINAL_X,
    "TX Order Delivered": TERMINAL_X,
    "TX Package Delivered": TERMINAL_X,
    "TX Order Shipped": TERMINAL_X,
    "TX Package Shipped": TERMINAL_X,
}

PART1_CREDS = {
    "Fetch Regular Orders": PRIORITY,
    "Fetch Marketplace Orders": PRIORITY,
    "PATCH ERP Delivered": PRIORITY,
    "PATCH ERP Other Status": PRIORITY,
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


def wire(workflow_id: str, mapping: dict[str, dict]) -> int:
    wf = api("GET", f"/api/v1/workflows/{workflow_id}")
    wired = 0
    for node in wf.get("nodes", []):
        name = node.get("name")
        if name not in mapping:
            continue
        node["credentials"] = mapping[name]
        wired += 1
    if wired == 0:
        print(f"No matching nodes in {workflow_id}")
        return 0
    payload = {
        "name": wf["name"],
        "nodes": wf["nodes"],
        "connections": wf["connections"],
        "settings": wf.get("settings", {}),
        "staticData": wf.get("staticData"),
    }
    api("PUT", f"/api/v1/workflows/{workflow_id}", payload)
    print(f"Wired {wired} node(s) on {wf['name']} ({workflow_id})")
    return wired


def main() -> None:
    if not API_KEY:
        print(
            "Set N8N_API_KEY (n8n Cloud → Settings → API → Create API Key), then re-run.",
            file=sys.stderr,
        )
        sys.exit(1)
    total = 0
    total += wire(PART2_ID, PART2_CREDS)
    total += wire(PART1_ID, PART1_CREDS)
    print(f"Done. {total} HTTP nodes now reference vault credentials.")
    print("Cheetah nodes use Authorization headers from Config (no vault cred needed).")


if __name__ == "__main__":
    main()
