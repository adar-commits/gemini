#!/usr/bin/env python3
"""Attach n8n credentials to Main Shipment Status Updater HTTP nodes via REST API.

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

WORKFLOW_ID = os.environ.get("N8N_WORKFLOW_ID", "ELcNThPE3EkYkDTc")

PRIORITY = {"httpBasicAuth": {"id": "XWHbq0ubZuDeRcDp", "name": "Carpetshop's Priority API"}}
SHOPIFY_MP = {"httpHeaderAuth": {"id": "I7KUKOeQTRwWCj9d", "name": "Shopify Marketplaces"}}
SHOPIFY_RC = {"httpHeaderAuth": {"id": "PdPxrKLtcWZ8NCoQ", "name": "Shopify Red Carpet"}}
TERMINAL_X = {"httpHeaderAuth": {"id": "ndHFodPPsWly8IP3", "name": "Terminal X"}}

NODE_CREDS = {
    "Fetch Regular Orders": PRIORITY,
    "Fetch Marketplace Orders": PRIORITY,
    "PATCH ERP Delivered": PRIORITY,
    "PATCH ERP Other Status": PRIORITY,
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


def main() -> None:
    if not API_KEY:
        print(
            "Set N8N_API_KEY (n8n Cloud → Settings → API → Create API Key), then re-run.",
            file=sys.stderr,
        )
        sys.exit(1)

    wf = api("GET", f"/api/v1/workflows/{WORKFLOW_ID}")
    wired = 0
    for node in wf.get("nodes", []):
        name = node.get("name")
        if name not in NODE_CREDS:
            continue
        node["credentials"] = NODE_CREDS[name]
        wired += 1

    if wired == 0:
        print(f"No matching nodes in {WORKFLOW_ID}")
        sys.exit(1)

    api(
        "PUT",
        f"/api/v1/workflows/{WORKFLOW_ID}",
        {
            "name": wf["name"],
            "nodes": wf["nodes"],
            "connections": wf["connections"],
            "settings": wf.get("settings", {}),
            "staticData": wf.get("staticData"),
        },
    )
    print(f"Wired {wired} HTTP nodes on {wf['name']} ({WORKFLOW_ID})")
    print("Cheetah nodes use Authorization headers from Config (no vault cred needed).")


if __name__ == "__main__":
    main()
