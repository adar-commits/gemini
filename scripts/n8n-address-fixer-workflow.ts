import {
  workflow,
  node,
  trigger,
  languageModel,
  outputParser,
  expr,
  newCredential,
} from "@n8n/workflow-sdk";

const addressWebhook = trigger({
  type: "n8n-nodes-base.webhook",
  version: 2.1,
  config: {
    name: "Webhook",
    parameters: {
      httpMethod: "POST",
      path: "address-parse",
      responseMode: "responseNode",
      options: {},
    },
    position: [240, 400],
  },
  output: [{ body: { raw_address: "test" }, headers: {} }],
});

const openAiChatModel = languageModel({
  type: "@n8n/n8n-nodes-langchain.lmChatOpenAi",
  version: 1.3,
  config: {
    name: "OpenAI Chat Model",
    parameters: {
      model: {
        __rl: true,
        mode: "list",
        value: "gpt-4.1-mini",
        cachedResultName: "gpt-4.1-mini",
      },
      options: { temperature: 0.2 },
    },
    credentials: { openAiApi: newCredential("OpenAI API") },
    position: [480, 720],
  },
});

const structuredParser = outputParser({
  type: "@n8n/n8n-nodes-langchain.outputParserStructured",
  version: 1.3,
  config: {
    name: "Address JSON Parser",
    parameters: {
      schemaType: "fromJson",
      jsonSchemaExample: JSON.stringify({
        street: "הרצל",
        streetNo: 12,
        floor: 3,
        apartment: 15,
        city: "תל אביב-יפו",
        original_input: "",
        confidence_score: 0.95,
        confidence_low: false,
      }),
    },
    position: [720, 720],
  },
});

const systemMsg = `You are a specialist in Israeli geography and address parsing. Return ONE structured JSON only (no tools). Input is raw_address from the user message.

Normalize Hebrew shortcuts and spelling variants to conventional Israeli city and street forms. Extract street, streetNo, floor, apartment, city; parse patterns like 4/12 as floor/apartment when apartment > floor; map Hebrew letter floors when present.

Set confidence_score between 0 and 1 and confidence_low true when unsure. Populate original_input with the same raw address string.

The next workflow steps validate your city and street against a spreadsheet — produce the best normalized strings you can; do not invent confidence above what you truly believe.`;

const addressAgent = node({
  type: "@n8n/n8n-nodes-langchain.agent",
  version: 3.1,
  config: {
    name: "AI Agent",
    parameters: {
      promptType: "define",
      text: expr(
        "{{ JSON.stringify({ raw_address: $json.body && $json.body.raw_address ? $json.body.raw_address : $json.body }) }}"
      ),
      hasOutputParser: true,
      options: {
        systemMessage: systemMsg,
        maxIterations: 1,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
    },
    subnodes: {
      model: openAiChatModel,
      outputParser: structuredParser,
    },
    position: [520, 400],
  },
  output: [
    {
      output: {
        street: "הרצל",
        streetNo: 12,
        floor: 3,
        apartment: 15,
        city: "תל אביב-יפו",
        original_input: "",
        confidence_score: 0.92,
        confidence_low: false,
      },
    },
  ],
});

const fetchRowsForCity = node({
  type: "n8n-nodes-base.googleSheets",
  version: 4.7,
  config: {
    name: "Fetch rows for city",
    parameters: {
      resource: "sheet",
      operation: "read",
      documentId: {
        __rl: true,
        mode: "list",
        value: "1eVFTSrsMQd-4KF7lcHP7AtANseNSLVaA-Sj5O3x_Gl0",
        cachedResultName: "Goverment Cities",
      },
      sheetName: {
        __rl: true,
        mode: "list",
        value: "gid=0",
        cachedResultName: "Sheet1",
      },
      filtersUI: {
        values: [
          {
            lookupColumn: "city_name",
            lookupValue: expr(
              '{{ $("AI Agent").first().json.output.city }}'
            ),
          },
        ],
      },
      combineFilters: "AND",
      options: {
        returnAllMatches: "returnAllMatches",
      },
    },
    credentials: {
      googleSheetsOAuth2Api: newCredential("Google Sheets account"),
    },
    alwaysOutputData: true,
    position: [720, 400],
  },
  output: [{ city_name: "תל אביב-יפו", street_name: "הרצל" }],
});

const gatekeeperCode = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Validate and gate output",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: `const agent = $('AI Agent').first().json;
const parsed = agent.output && typeof agent.output === 'object' ? agent.output : agent;
const webhookBody = $('Webhook').first().json.body || {};
const rawInput = String(parsed.original_input || webhookBody.raw_address || '');
const rows = $('Fetch rows for city').all().map((i) => i.json);

function norm(s) {
  return String(s || '').replace(/\\s+/g, ' ').trim().toLowerCase();
}

function streetCell(row) {
  return row.street_name ?? row.Street ?? row.street ?? '';
}

function fuzzyStreetMatch(candidate, rowList) {
  const c = norm(candidate);
  if (!c) return { ok: false };
  for (const row of rowList) {
    const st = streetCell(row);
    const n = norm(st);
    if (!n) continue;
    if (c === n || c.includes(n) || n.includes(c)) return { ok: true, official: st };
  }
  return { ok: false };
}

const cityOk = rows.length > 0;
const sm = fuzzyStreetMatch(parsed.street, rows);
const sheetOk = cityOk && sm.ok;

let conf = typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0;
let low = parsed.confidence_low === true;

if (!sheetOk) {
  low = true;
  conf = Math.min(conf, 0.85);
}

let streetOut = sm.ok && sm.official ? sm.official : parsed.street;

let floor = parsed.floor;
let apartment = parsed.apartment;
if (floor != null && apartment != null && typeof floor === 'number' && typeof apartment === 'number' && apartment < floor) {
  const t = floor;
  floor = apartment;
  apartment = t;
}

if (conf < 0.9 || low) {
  return [{ json: { original_input: rawInput } }];
}

return [{
  json: {
    street: streetOut,
    streetNo: parsed.streetNo,
    floor: floor ?? null,
    apartment: apartment ?? null,
    city: parsed.city,
    original_input: rawInput,
    confidence_score: conf
  }
}];`,
    },
    position: [920, 400],
  },
  output: [
    {
      json: {
        street: "הרצל",
        streetNo: 12,
        city: "תל אביב-יפו",
        original_input: "",
        confidence_score: 0.95,
      },
    },
  ],
});

const respondWebhook = node({
  type: "n8n-nodes-base.respondToWebhook",
  version: 1.5,
  config: {
    name: "Respond to Webhook",
    parameters: {
      respondWith: "json",
      responseBody: expr("{{ $json }}"),
      options: { responseCode: 200 },
    },
    position: [1160, 400],
  },
});

export default workflow(
  "address-fixer-fast-v1",
  "Address Fixer v2 — shipping parse"
)
  .add(addressWebhook)
  .to(addressAgent)
  .to(fetchRowsForCity)
  .to(gatekeeperCode)
  .to(respondWebhook);
