import {
  workflow,
  node,
  trigger,
  languageModel,
  tool,
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
  output: [{ body: { raw_address: "דוגמה רחוב 1 תל אביב" }, headers: {} }],
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
        value: "gpt-4o",
        cachedResultName: "gpt-4o",
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

const googleSheetCityVerify = tool({
  type: "n8n-nodes-base.googleSheetsTool",
  version: 4.7,
  config: {
    name: "Verify city in sheet",
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
            lookupColumn: "City",
            lookupValue:
              "={{ $fromAI('city_match', 'Normalized official city name to match the City column exactly', 'string') }}",
          },
        ],
      },
      combineFilters: "AND",
      options: {
        returnAllMatches: "returnFirstMatch",
      },
    },
    credentials: {
      googleSheetsOAuth2Api: newCredential("Google Sheets account"),
    },
    position: [520, 560],
  },
});

const googleSheetStreets = tool({
  type: "n8n-nodes-base.googleSheetsTool",
  version: 4.7,
  config: {
    name: "List streets for city",
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
            lookupColumn: "City",
            lookupValue:
              "={{ $fromAI('city_for_streets', 'Confirmed official city name; returns all sheet rows so you can read the Street column', 'string') }}",
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
    position: [680, 560],
  },
});

const systemMsg = `You are a specialist in Israeli geography and address parsing. Take the raw_address from the user message JSON and return structured fields.

Extraction rules:
- Normalization: Map Hebrew shortcuts to official names (Tel Aviv variants including Tel-Aviv-Yafo, Ramat Gan, etc.).
- City/street validation: First infer the city. Use "Verify city in sheet" with the official City column value you want to verify. Use City_Synonyms from returned rows when variants appear in the sheet.
- After the city is confirmed, call "List streets for city" with that same official city name and fuzzy-match the street against the Street column only within those rows.
- Never invent a city or street that is not supported by tool results.

Numbers:
- streetNo follows the street name when present.
- Floor and apartment: patterns like 6/18 mean floor 6, apartment 18 when apartment > floor; Hebrew letters like ב for floor 2 map to integers.

Uncertainty:
- If match confidence is below 90 percent or data is missing from the sheet, set confidence_low true and set confidence_score below 0.9.

Populate original_input with the same raw_address string from the input JSON.`;

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
        maxIterations: 15,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
    },
    subnodes: {
      model: openAiChatModel,
      tools: [googleSheetCityVerify, googleSheetStreets],
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

const gatekeeperCode = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Validate and gate output",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: `const items = $input.all();
const first = items[0].json;
const parsed = first.output && typeof first.output === "object" ? first.output : first;
const webhookBody = $("Webhook").first().json.body || {};
const rawInput = parsed.original_input || webhookBody.raw_address || "";
let floor = parsed.floor;
let apartment = parsed.apartment;
if (floor != null && apartment != null && typeof floor === "number" && typeof apartment === "number" && apartment < floor) {
  const t = floor;
  floor = apartment;
  apartment = t;
}
const conf = typeof parsed.confidence_score === "number" ? parsed.confidence_score : 0;
const low = parsed.confidence_low === true;
if (conf < 0.9 || low) {
  return [{ json: { original_input: String(rawInput) } }];
}
return [{
  json: {
    street: parsed.street,
    streetNo: parsed.streetNo,
    floor: floor ?? null,
    apartment: apartment ?? null,
    city: parsed.city,
    original_input: String(rawInput),
    confidence_score: conf
  }
}];`,
    },
    position: [880, 400],
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
    position: [1120, 400],
  },
});

export default workflow(
  "address-fixer-shipping-webhook",
  "Address Fixer v2 — shipping parse"
)
  .add(addressWebhook)
  .to(addressAgent)
  .to(gatekeeperCode)
  .to(respondWebhook);
