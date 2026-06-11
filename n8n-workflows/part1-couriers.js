import {
  workflow,
  node,
  trigger,
  sticky,
  newCredential,
  ifElse,
  switchCase,
  splitInBatches,
  nextBatch,
  expr,
} from '@n8n/workflow-sdk';

const scheduleTrigger = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 2 Hours',
    position: [0, 400],
    parameters: {
      rule: {
        interval: [{ field: 'hours', hoursInterval: 2 }],
      },
    },
  },
  output: [{}],
});

const setConfig = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Config',
    position: [240, 400],
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'cb', name: 'cheetahBaseUrl', value: 'chita-il.com/RunCom.Server/Request.aspx', type: 'string' },
          { id: 'tb', name: 'tigerBaseUrl', value: 'tiger.xsyspro.net:8022/Baldarp/service.asmx', type: 'string' },
          { id: 'mpd', name: 'marketplaceDaysBack', value: 35, type: 'number' },
          { id: 'rd', name: 'regularDaysBack', value: 40, type: 'number' },
          { id: 'ctx', name: 'cheetahTxBearer', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL3J1bmNvbS5jby5pbC9jbGFpbXMvY2xpZW50bm8iOiIzMTQyMyIsImh0dHBzOi8vcnVuY29tLmNvLmlsL2NsYWltcy9waHJhc2UiOiI0MDcwMWFhNi1lZjI2LTQxOTYtODUwNi01NzNkOGM4MDcxNmQiLCJleHAiOjE3ODA1NTQwMDcsImlzcyI6Imh0dHBzOi8vcnVuY29tLmNvLmlsIiwiYXVkIjoiaHR0cHM6Ly9ydW5jb20uY28uaWwifQ.2QPPq7Tmi2BToOdee6hpYg9zIbxkZf-SpT_pDXxiYhk', type: 'string' },
          { id: 'crc', name: 'cheetahRcBearer', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJodHRwczovL3J1bmNvbS5jby5pbC9jbGFpbXMvY2xpZW50bm8iOiIzMTIzNCIsImh0dHBzOi8vcnVuY29tLmNvLmlsL2NsYWltcy9waHJhc2UiOiIyYWY2ZjA0My03ZDIyLTRjZTUtYTZhYS05NWYyODFiMTI5OGQiLCJleHAiOjE4MDA5NTE3NTgsImlzcyI6Imh0dHBzOi8vcnVuY29tLmNvLmlsIiwiYXVkIjoiaHR0cHM6Ly9ydW5jb20uY28uaWwifQ.URw_G0PwM3Az7LJiXKQNKWwB8FBsk1Jz0yXzdvalSdg', type: 'string' },
        ],
      },
    },
  },
  output: [{ cheetahBaseUrl: 'chita-il.com/RunCom.Server/Request.aspx', tigerBaseUrl: 'tiger.xsyspro.net:8022/Baldarp/service.asmx', marketplaceDaysBack: 35, regularDaysBack: 40 }],
});

const buildQueryDates = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Query Dates',
    position: [480, 400],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const config = $input.first().json;
const fmt = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day + 'T09:59:00%2B02:00';
};
return [{
  json: {
    ...config,
    regularDateFilter: fmt(config.regularDaysBack),
    marketplaceDateFilter: fmt(config.marketplaceDaysBack),
  },
}];`,
    },
  },
  output: [{ regularDateFilter: '2026-05-02T09:59:00%2B02:00', marketplaceDateFilter: '2026-05-07T09:59:00%2B02:00' }],
});

const fetchRegularOrders = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Fetch Regular Orders',
    position: [720, 280],
    parameters: {
      method: 'GET',
      url: expr('={{ "https://carpetshop.wee.co.il/odata/Priority/tabula.ini/a051118/ORDERS?$filter=TYPECODE ne \'12\' AND TYPECODE ne \'04\' AND TYPECODE ne \'09\' AND TYPECODE ne \'11\' AND ORDSTATUSDES ne \'מבוטלת\' AND LTRN_BALDARTRCK eq \'*\' AND CURDATE%20gt%20" + $json.regularDateFilter + "&$select=ORDNAME,LTRN_BALDARTRCK,TOPP_MARKETNAME,REFERENCE,ZPIT_DELSTATUSCODE" }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBasicAuth',
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpBasicAuth: newCredential("Carpetshop's Priority API") },
  },
  output: [{ value: [{ ORDNAME: 'SO24001', LTRN_BALDARTRCK: '11234567', TOPP_MARKETNAME: '', REFERENCE: '6123456789012', ZPIT_DELSTATUSCODE: '2' }] }],
});

const fetchMarketplaceOrders = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Fetch Marketplace Orders',
    position: [720, 520],
    executeOnce: true,
    parameters: {
      method: 'GET',
      url: expr('={{ "https://carpetshop.wee.co.il/odata/Priority/tabula.ini/a051118/ORDERS?$filter=TYPECODE eq \'12\' AND ORDSTATUSDES ne \'מבוטלת\' AND LTRN_BALDARTRCK eq \'*\' AND CURDATE%20ge%20" + $("Build Query Dates").item.json.marketplaceDateFilter + "&$select=ORDNAME,LTRN_BALDARTRCK,TOPP_MARKETNAME,REFERENCE,ZPIT_DELSTATUSCODE" }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBasicAuth',
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpBasicAuth: newCredential("Carpetshop's Priority API") },
  },
  output: [{ value: [{ ORDNAME: 'SO24002', LTRN_BALDARTRCK: '81234567', TOPP_MARKETNAME: 'טרמינל X', REFERENCE: '6987654321012', ZPIT_DELSTATUSCODE: '3' }] }],
});

const combineOrders = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Combine Orders',
    position: [960, 400],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const regular = $('Fetch Regular Orders').first().json.value || [];
const marketplace = $('Fetch Marketplace Orders').first().json.value || [];
const rows = [
  ...regular.map((o) => ({ ...o, orderType: 'regular' })),
  ...marketplace.map((o) => ({ ...o, orderType: 'marketplace' })),
];
return rows.map((json) => ({ json }));`,
    },
  },
  output: [{ ORDNAME: 'SO24001', LTRN_BALDARTRCK: '11234567', orderType: 'regular' }],
});

const orderLoop = splitInBatches({
  version: 3,
  config: { name: 'Each Order', position: [1200, 400], parameters: { batchSize: 1 } },
});

const routeCourier = switchCase({
  version: 3.4,
  config: {
    name: 'Route Courier',
    position: [1440, 400],
    parameters: {
      rules: {
        values: [
          {
            outputKey: 'Tiger',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
              conditions: [
                { leftValue: expr('{{ $json.LTRN_BALDARTRCK }}'), operator: { type: 'string', operation: 'startsWith' }, rightValue: '1' },
              ],
              combinator: 'or',
            },
          },
          {
            outputKey: 'Tiger Neg',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
              conditions: [
                { leftValue: expr('{{ $json.LTRN_BALDARTRCK }}'), operator: { type: 'string', operation: 'startsWith' }, rightValue: '-1' },
              ],
              combinator: 'and',
            },
          },
          {
            outputKey: 'Cheetah',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
              conditions: [
                { leftValue: expr('{{ $json.LTRN_BALDARTRCK }}'), operator: { type: 'string', operation: 'startsWith' }, rightValue: '8' },
              ],
              combinator: 'or',
            },
          },
          {
            outputKey: 'Cheetah 9',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
              conditions: [
                { leftValue: expr('{{ $json.LTRN_BALDARTRCK }}'), operator: { type: 'string', operation: 'startsWith' }, rightValue: '9' },
              ],
              combinator: 'and',
            },
          },
          {
            outputKey: 'Sela',
            conditions: {
              options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
              conditions: [
                { leftValue: expr('{{ $json.LTRN_BALDARTRCK }}'), operator: { type: 'string', operation: 'contains' }, rightValue: 'L' },
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

const tigerGetDelivery = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Tiger Get Delivery',
    position: [1680, 200],
    parameters: {
      method: 'GET',
      url: expr('={{ "http://" + $("Config").item.json.tigerBaseUrl + "/GetDeliveryDetails?pParam=" + $json.LTRN_BALDARTRCK }}'),
      options: { response: { response: { responseFormat: 'text' } } },
    },
  },
  output: [{ data: '2026-06-01;foo;bar;baz;50;extra' }],
});

const mapTigerStatus = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Map Tiger Status',
    position: [1920, 200],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `const map = { '50': '5', '25': '4', '3': '6', '2': '4' };
const raw = String($json.data || '').split(';')[4] || '';
const mapped = map[raw] ?? null;
const order = $('Each Order').item.json;
let deliveryDate = null;
if (mapped === '6' && $json.data) {
  deliveryDate = String($json.data).substring(0, 10);
}
return { json: { ...order, courier: 'tiger', rawStatus: raw, mappedStatus: mapped, deliveryDate } };`,
    },
  },
  output: [{ ORDNAME: 'SO24001', mappedStatus: '5', courier: 'tiger', ZPIT_DELSTATUSCODE: '2' }],
});

const cheetahGetDelivery = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Cheetah Get Delivery',
    position: [1680, 400],
    onError: 'continueErrorOutput',
    parameters: {
      method: 'GET',
      url: expr('={{ "https://" + $("Config").item.json.cheetahBaseUrl + "?APPNAME=run&PRGNAME=ship_status_xml&ARGUMENTS=-N" + $json.LTRN_BALDARTRCK }}'),
      authentication: 'none',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: expr('={{ $("Build Query Dates").item.json.cheetahTxBearer }}') },
        ],
      },
      options: { response: { response: { responseFormat: 'text' } } },
    },
  },
  output: [{ data: '<root><mydata><status><status_code>21</status_code><status_date>2026-06-01</status_date><status_time>14:30:00</status_time></status></mydata></root>' }],
});

const cheetahBackup = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Cheetah Backup Bearer',
    position: [1680, 560],
    parameters: {
      method: 'GET',
      url: expr('={{ "https://" + $("Config").item.json.cheetahBaseUrl + "?APPNAME=run&PRGNAME=ship_status_xml&ARGUMENTS=-N" + $("Each Order").item.json.LTRN_BALDARTRCK }}'),
      authentication: 'none',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: expr('={{ $("Build Query Dates").item.json.cheetahRcBearer }}') },
        ],
      },
      options: { response: { response: { responseFormat: 'text' } } },
    },
  },
  output: [{ data: '<root><mydata><status><status_code>21</status_code></status></mydata></root>' }],
});

const cheetahToXml = node({
  type: 'n8n-nodes-base.xml',
  version: 1,
  config: {
    name: 'Parse Cheetah XML',
    position: [1920, 400],
    parameters: { mode: 'xmlToJson', dataPropertyName: 'data' },
  },
  output: [{ root: { mydata: [{ status: [{ status_code: '21', status_date: '2026-06-01', status_time: '14:30:00' }] }] } }],
});

const mapCheetahStatus = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Map Cheetah Status',
    position: [2160, 400],
    parameters: {
      mode: 'runOnceForEachItem',
      language: 'javaScript',
      jsCode: `const map = { '3':'2','4':'2','5':'2','15':'3','21':'4','24':'7','27':'5','28':'5','30':'888','35':'10','41':'12','45':'12','98':'13','99':'6','167':'4' };
const statuses = $json.root?.mydata?.[0]?.status || [];
const last = statuses[statuses.length - 1] || {};
const raw = String(last.status_code || '');
const mapped = map[raw] ?? null;
const order = $('Each Order').item.json;
let deliveryDate = null;
if (mapped === '6' && last.status_date && last.status_time) {
  deliveryDate = last.status_date + ' ' + last.status_time;
}
return { json: { ...order, courier: 'cheetah', rawStatus: raw, mappedStatus: mapped, deliveryDate } };`,
    },
  },
  output: [{ ORDNAME: 'SO24002', mappedStatus: '4', courier: 'cheetah', ZPIT_DELSTATUSCODE: '3' }],
});

const prepareSela = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Prepare Sela Logistics',
    position: [1680, 700],
    parameters: {
      mode: 'manual',
      includeOtherFields: true,
      assignments: {
        assignments: [
          { id: 'c', name: 'courier', value: 'sela', type: 'string' },
          { id: 'm', name: 'mappedStatus', value: expr('{{ $json.ZPIT_DELSTATUSCODE }}'), type: 'string' },
        ],
      },
    },
  },
  output: [{ ORDNAME: 'SO24003', courier: 'sela', mappedStatus: '4', LTRN_BALDARTRCK: 'L12345' }],
});

const statusChanged = ifElse({
  version: 2.3,
  config: {
    name: 'Status Changed?',
    position: [2400, 400],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          { leftValue: expr('{{ $json.mappedStatus }}'), operator: { type: 'string', operation: 'notEmpty' }, rightValue: '' },
          { leftValue: expr('{{ $json.mappedStatus }}'), operator: { type: 'string', operation: 'notEquals' }, rightValue: expr('{{ $json.ZPIT_DELSTATUSCODE }}') },
        ],
        combinator: 'and',
      },
    },
  },
});

const isDelivered = ifElse({
  version: 2.3,
  config: {
    name: 'Is Delivered?',
    position: [2640, 320],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          { leftValue: expr('{{ $json.mappedStatus }}'), operator: { type: 'string', operation: 'equals' }, rightValue: '6' },
        ],
        combinator: 'and',
      },
    },
  },
});

const patchOtherStatus = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'PATCH ERP Other Status',
    position: [2880, 420],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'PATCH',
      url: expr('={{ "https://carpetshop.wee.co.il/odata/Priority/tabula.ini/a051118/ORDERS(\'" + $json.ORDNAME + "\')" }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBasicAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ ZPIT_DELSTATUSCODE: $json.mappedStatus, ZPIT_UDATE: $now.setZone("Asia/Jerusalem").toFormat("yyyy-MM-dd\'T\'HH:mm:00ZZ") }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpBasicAuth: newCredential("Carpetshop's Priority API") },
  },
  output: [{ ZPIT_DELSTATUSCODE: '5' }],
});

const patchDelivered = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'PATCH ERP Delivered',
    position: [2880, 220],
    onError: 'continueRegularOutput',
    parameters: {
      method: 'PATCH',
      url: expr('={{ "https://carpetshop.wee.co.il/odata/Priority/tabula.ini/a051118/ORDERS(\'" + $json.ORDNAME + "\')" }}'),
      authentication: 'genericCredentialType',
      genericAuthType: 'httpBasicAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ ZPIT_DELSTATUSCODE: $json.mappedStatus, ZPIT_UDATE: $now.setZone("Asia/Jerusalem").toFormat("yyyy-MM-dd\'T\'HH:mm:00ZZ"), ZPIT_DELDATE: $json.deliveryDate ? $now.setZone("Asia/Jerusalem").toFormat("yyyy-MM-dd\'T\'HH:mm:00ZZ") : $now.setZone("Asia/Jerusalem").toFormat("yyyy-MM-dd\'T\'HH:mm:00ZZ"), ZPIT_DELIVERED: "Y" }) }}'),
      options: { response: { response: { responseFormat: 'json' } } },
    },
    credentials: { httpBasicAuth: newCredential("Carpetshop's Priority API") },
  },
  output: [{ ZPIT_DELIVERED: 'Y' }],
});

const shouldNotifyPart2 = ifElse({
  version: 2.3,
  config: {
    name: 'Notify Part 2?',
    position: [3120, 400],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          { leftValue: expr('{{ $json.mappedStatus }}'), operator: { type: 'string', operation: 'notEmpty' }, rightValue: '' },
        ],
        combinator: 'and',
      },
    },
  },
});

const callPart2 = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Call Part 2 Fulfillments',
    position: [3360, 400],
    onError: 'continueRegularOutput',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'list', value: 'f2QJ3Gj47tB3JTA8', cachedResultName: 'Courier & Shopify Fulfillments' },
      mode: 'each',
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          REFERENCE: expr('{{ $json.orderType === "marketplace" ? $json.REFERENCE : "" }}'),
          REFERENCE2: expr('{{ $json.orderType === "regular" ? $json.REFERENCE : "" }}'),
          LTRN_BALDARTRCK: expr('{{ $json.LTRN_BALDARTRCK }}'),
          ZPIT_DELSTATUSCODE: expr('{{ $json.mappedStatus }}'),
          TOPP_MARKETNAME: expr('{{ $json.TOPP_MARKETNAME || "" }}'),
        },
      },
    },
  },
  output: [{ ok: true }],
});

const loopDone = node({
  type: 'n8n-nodes-base.set',
  version: 3.4,
  config: {
    name: 'Sync Complete',
    position: [1440, 120],
    parameters: {
      mode: 'manual',
      assignments: {
        assignments: [
          { id: 'done', name: 'status', value: 'completed', type: 'string' },
          { id: 'ts', name: 'completedAt', value: expr('{{ $now.toISO() }}'), type: 'string' },
        ],
      },
    },
  },
  output: [{ status: 'completed' }],
});

const tigerBranch = tigerGetDelivery.to(mapTigerStatus);
const cheetahBranch = cheetahGetDelivery
  .onError(cheetahBackup.to(cheetahToXml))
  .to(cheetahToXml)
  .to(mapCheetahStatus);

const processStatus = statusChanged
  .onTrue(isDelivered
    .onTrue(patchDelivered.to(shouldNotifyPart2.onTrue(callPart2.to(nextBatch(orderLoop)))))
    .onFalse(patchOtherStatus.to(shouldNotifyPart2.onTrue(callPart2.to(nextBatch(orderLoop))))),
  )
  .onFalse(nextBatch(orderLoop));

const overviewNote = sticky(
  '## Part 1: Courier Status Sync\n\nSingle workflow replaces Make\'s duplicated Regular/Marketplace routers.\nFetches Priority orders (different day windows), routes Tiger/Cheetah/Sela, updates ERP, calls Part 2.\n\n**Status:** Draft — not activated.',
  [scheduleTrigger, setConfig, fetchRegularOrders],
  { color: 5, position: [-80, 80] },
);

export default workflow(
  'main-shipment-status-couriers',
  'Main Shipment Status Updater Part 1: Couriers',
)
  .add(scheduleTrigger)
  .to(setConfig)
  .to(buildQueryDates)
  .to(fetchRegularOrders)
  .to(fetchMarketplaceOrders)
  .to(combineOrders)
  .to(orderLoop
    .onDone(loopDone)
    .onEachBatch(routeCourier
      .onCase(0, tigerBranch.to(processStatus))
      .onCase(1, tigerBranch.to(processStatus))
      .onCase(2, cheetahBranch.to(processStatus))
      .onCase(3, cheetahBranch.to(processStatus))
      .onCase(4, prepareSela.to(shouldNotifyPart2.onTrue(callPart2.to(nextBatch(orderLoop)))))
    ),
  )
  .add(overviewNote);
