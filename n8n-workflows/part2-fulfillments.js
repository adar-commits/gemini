import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  ifElse,
  switchCase,
  expr,
} from '@n8n/workflow-sdk';

const subTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'When Called by Part 1',
    position: [0, 300],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'REFERENCE', type: 'string' },
          { name: 'REFERENCE2', type: 'string' },
          { name: 'LTRN_BALDARTRCK', type: 'string' },
          { name: 'ZPIT_DELSTATUSCODE', type: 'string' },
          { name: 'TOPP_MARKETNAME', type: 'string' },
        ],
      },
    },
  },
  output: [{
    REFERENCE: '6123456789012',
    REFERENCE2: '',
    LTRN_BALDARTRCK: '81234567',
    ZPIT_DELSTATUSCODE: '4',
    TOPP_MARKETNAME: 'טרמינל X',
  }],
});

const normalizePayload = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Normalize Payload',
    position: [240, 300],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'ref', name: 'REFERENCE', value: expr('{{ $json.REFERENCE ?? "" }}'), type: 'string' },
          { id: 'ref2', name: 'REFERENCE2', value: expr('{{ $json.REFERENCE2 ?? "" }}'), type: 'string' },
          { id: 'trk', name: 'LTRN_BALDARTRCK', value: expr('{{ $json.LTRN_BALDARTRCK ?? "" }}'), type: 'string' },
          { id: 'status', name: 'ZPIT_DELSTATUSCODE', value: expr('{{ $json.ZPIT_DELSTATUSCODE ?? "" }}'), type: 'string' },
          { id: 'market', name: 'TOPP_MARKETNAME', value: expr('{{ $json.TOPP_MARKETNAME ?? "" }}'), type: 'string' },
          { id: 'shopifyOrderId', name: 'shopifyOrderId', value: expr('{{ $json.REFERENCE || $json.REFERENCE2 || "" }}'), type: 'string' },
        ],
      },
    },
  },
  output: [{
    REFERENCE: '6123456789012',
    REFERENCE2: '',
    LTRN_BALDARTRCK: '81234567',
    ZPIT_DELSTATUSCODE: '4',
    TOPP_MARKETNAME: 'טרמינל X',
    shopifyOrderId: '6123456789012',
  }],
});

const updateTrackingMetafield = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Update Tracking Metafield',
    position: [480, 300],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://marketplacesredcarpetil.myshopify.com/admin/api/2025-10/graphql.json',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ query: "mutation { metafieldsSet(metafields: [{namespace: \\"custom\\", ownerId: \\"gid://shopify/Order/" + $json.shopifyOrderId + "\\", type: \\"single_line_text_field\\", key: \\"courier_tracking_number\\", value: \\"" + $json.LTRN_BALDARTRCK + "\\"}]) { metafields { key value } userErrors { field message } } }" }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpHeaderAuth: newCredential('Shopify Marketplaces') },
  },
  output: [{ data: { metafieldsSet: { metafields: [{ key: 'courier_tracking_number', value: '81234567' }] } } }],
});

const getMarketplaceFulfillmentOrder = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Marketplace Fulfillment Order',
    position: [720, 300],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://marketplacesredcarpetil.myshopify.com/admin/api/2024-10/graphql.json',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ query: "{ order(id:\\"gid://shopify/Order/" + ($json.REFERENCE || "") + "\\") { fulfillmentOrders(first:1) { edges { node { id } } } } }" }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpHeaderAuth: newCredential('Shopify Marketplaces') },
  },
  output: [{ data: { order: { fulfillmentOrders: { edges: [{ node: { id: 'gid://shopify/FulfillmentOrder/1' } }] } } } }],
});

const getTerminalXMetafields = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Get Terminal X Metafields',
    position: [960, 300],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://marketplacesredcarpetil.myshopify.com/admin/api/2024-10/graphql.json',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ query: "query { order(id: \\"gid://shopify/Order/" + ($json.REFERENCE || "") + "\\") { metafields(first: 10, namespace: \\"custom\\") { nodes { key value } } } }" }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpHeaderAuth: newCredential('Shopify Marketplaces') },
  },
  output: [{ data: { order: { metafields: { nodes: [{ key: 'terminal_x_order_id', value: 'TX-123' }, { key: 'terminal_x_package_id', value: 'PKG-456' }] } } } }],
});

const extractTerminalXIds = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Extract Terminal X IDs',
    position: [1200, 300],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `const normalized = $('Normalize Payload').item.json;
const nodes = $json.data?.order?.metafields?.nodes || [];
const byKey = Object.fromEntries(nodes.map((n) => [n.key, n.value]));
return {
  json: {
    ...normalized,
    terminalXOrderId: byKey.terminal_x_order_id || '',
    terminalXPackageId: byKey.terminal_x_package_id || '',
    fulfillmentOrderId: $('Get Marketplace Fulfillment Order').item.json.data?.order?.fulfillmentOrders?.edges?.[0]?.node?.id || '',
  },
};`,
    },
  },
  output: [{
    terminalXOrderId: 'TX-123',
    terminalXPackageId: 'PKG-456',
    fulfillmentOrderId: 'gid://shopify/FulfillmentOrder/1',
    ZPIT_DELSTATUSCODE: '4',
    TOPP_MARKETNAME: 'טרמינל X',
    LTRN_BALDARTRCK: '81234567',
    REFERENCE2: '',
  }],
});

const routeDestination = switchCase({
  version: 3.4,
  config: {
    name: 'Route Destination',
    position: [1440, 300],
    parameters: {
      rules: {
        values: [
          {
            outputKey: 'Regular Shopify',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
              conditions: [{ leftValue: expr('{{ $json.REFERENCE2 }}'), operator: { type: 'string', operation: 'notEmpty' }, rightValue: '' }],
              combinator: 'and',
            },
          },
          {
            outputKey: 'Terminal X',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
              conditions: [{ leftValue: expr('{{ $json.TOPP_MARKETNAME }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'טרמינל X' }],
              combinator: 'and',
            },
          },
        ],
      },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'Other Marketplaces' },
    },
  },
});

const lookupRegularOrder = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Lookup Regular Shopify Order',
    position: [1680, 80],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://redcarpetil.myshopify.com/admin/api/2025-10/graphql.json',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ query: "{ orders(first: 1, query: \\"name:" + $("Normalize Payload").item.json.REFERENCE2 + "\\") { edges { node { id fulfillmentOrders(first: 1) { edges { node { id } } } } } } }" }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpHeaderAuth: newCredential('Shopify Red Carpet') },
  },
  output: [{ data: { orders: { edges: [{ node: { fulfillmentOrders: { edges: [{ node: { id: 'gid://shopify/FulfillmentOrder/99' } }] } } }] } } }],
});

const createRegularFulfillment = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Regular Fulfillment',
    position: [1920, 80],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://redcarpetil.myshopify.com/admin/api/2025-10/graphql.json',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ query: "mutation { fulfillmentCreateV2(fulfillment: { lineItemsByFulfillmentOrder: [{ fulfillmentOrderId: \\"" + ($json.data.orders.edges[0].node.fulfillmentOrders.edges[0].node.id || "") + "\\" }], trackingInfo: { company: \\"Cheetah\\", number: \\"" + $("Normalize Payload").item.json.LTRN_BALDARTRCK + "\\" } }) { fulfillment { id } userErrors { field message } } }" }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpHeaderAuth: newCredential('Shopify Red Carpet') },
  },
  output: [{ data: { fulfillmentCreateV2: { fulfillment: { id: 'gid://shopify/Fulfillment/1' } } } }],
});

const txPacked = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'TX Order Packed',
    position: [1680, 300],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://mp.terminalx.com/partners/api/v1/vendor/orders/update',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ orderId: $json.terminalXOrderId, status: "Packed", externalTrackingCode: $("Normalize Payload").item.json.LTRN_BALDARTRCK }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpHeaderAuth: newCredential('Terminal X') },
  },
  output: [{ status: 'Packed' }],
});

const routeTxStatus = switchCase({
  version: 3.4,
  config: {
    name: 'Route TX Status',
    position: [1920, 300],
    parameters: {
      rules: {
        values: [
          {
            outputKey: 'Delivered',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
              conditions: [{ leftValue: expr('{{ $json.ZPIT_DELSTATUSCODE }}'), operator: { type: 'string', operation: 'equals' }, rightValue: '6' }],
              combinator: 'and',
            },
          },
          {
            outputKey: 'Shipped',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
              conditions: [
                { leftValue: expr('{{ $json.ZPIT_DELSTATUSCODE }}'), operator: { type: 'string', operation: 'notEquals' }, rightValue: '6' },
                { leftValue: expr('{{ $json.ZPIT_DELSTATUSCODE }}'), operator: { type: 'string', operation: 'notEquals' }, rightValue: '9' },
              ],
              combinator: 'and',
            },
          },
        ],
      },
      options: { fallbackOutput: 'none' },
    },
  },
});

const txOrderDelivered = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'TX Order Delivered',
    position: [2160, 220],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://mp.terminalx.com/partners/api/v1/vendor/orders/update',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ orderId: $("Extract Terminal X IDs").item.json.terminalXOrderId, status: "Delivered", externalTrackingCode: $("Normalize Payload").item.json.LTRN_BALDARTRCK }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpHeaderAuth: newCredential('Terminal X') },
  },
  output: [{ status: 'Delivered' }],
});

const txPackageDelivered = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'TX Package Delivered',
    position: [2400, 220],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://mp.terminalx.com/partners/api/v1/vendor/tracking/update',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ user: "redcarpet", code: "773525ae-33af-4839-ac8d-75808dc1dc8e", packageId: $("Extract Terminal X IDs").item.json.terminalXPackageId, status: 5, statusTime: $now.toFormat("yyyy-MM-dd HH:mm:ss"), failureReason: "", externalTrackingCode: $("Normalize Payload").item.json.LTRN_BALDARTRCK }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpHeaderAuth: newCredential('Terminal X') },
  },
  output: [{ status: 5 }],
});

const txOrderShipped = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'TX Order Shipped',
    position: [2160, 380],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://mp.terminalx.com/partners/api/v1/vendor/orders/update',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ orderId: $("Extract Terminal X IDs").item.json.terminalXOrderId, status: "Shipped", externalTrackingCode: $("Normalize Payload").item.json.LTRN_BALDARTRCK }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpHeaderAuth: newCredential('Terminal X') },
  },
  output: [{ status: 'Shipped' }],
});

const txPackageShipped = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'TX Package Shipped',
    position: [2400, 380],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://mp.terminalx.com/partners/api/v1/vendor/tracking/update',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ user: "redcarpet", code: "773525ae-33af-4839-ac8d-75808dc1dc8e", packageId: $("Extract Terminal X IDs").item.json.terminalXPackageId, status: 4, statusTime: $now.toFormat("yyyy-MM-dd HH:mm:ss"), failureReason: "", externalTrackingCode: $("Normalize Payload").item.json.LTRN_BALDARTRCK }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpHeaderAuth: newCredential('Terminal X') },
  },
  output: [{ status: 4 }],
});

const createMarketplaceFulfillment = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Create Marketplace Fulfillment',
    position: [1680, 520],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://marketplacesredcarpetil.myshopify.com/admin/api/2024-10/graphql.json',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ query: "mutation { fulfillmentCreateV2(fulfillment: { lineItemsByFulfillmentOrder: [{ fulfillmentOrderId: \\"" + ($json.fulfillmentOrderId || "") + "\\" }], trackingInfo: { company: \\"Cheetah\\", number: \\"" + $("Normalize Payload").item.json.LTRN_BALDARTRCK + "\\" } }) { fulfillment { id } userErrors { field message } } }" }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpHeaderAuth: newCredential('Shopify Marketplaces') },
  },
  output: [{ data: { fulfillmentCreateV2: { fulfillment: { id: 'gid://shopify/Fulfillment/2' } } } }],
});

const overviewNote = sticky(
  '## Part 2: Shopify & Terminal X Fulfillments\n\nCalled by Part 1 with order + tracking + status.\nUpdates Shopify tracking metafields, creates fulfillments, and syncs Terminal X when marketplace is Terminal X.\n\n**Status:** Draft — not activated.',
  [subTrigger, normalizePayload, updateTrackingMetafield],
  { color: 4, position: [-80, 80] },
);

export default workflow(
  'courier-shopify-fulfillments',
  'Courier & Shopify Fulfillments',
)
  .add(subTrigger)
  .to(normalizePayload)
  .to(updateTrackingMetafield)
  .to(getMarketplaceFulfillmentOrder)
  .to(getTerminalXMetafields)
  .to(extractTerminalXIds)
  .to(routeDestination
    .onCase(0, lookupRegularOrder.to(createRegularFulfillment))
    .onCase(1, txPacked.to(routeTxStatus
      .onCase(0, txOrderDelivered.to(txPackageDelivered))
      .onCase(1, txOrderShipped.to(txPackageShipped))
    ).to(createMarketplaceFulfillment))
    .onCase(2, createMarketplaceFulfillment),
  )
  .add(overviewNote);
