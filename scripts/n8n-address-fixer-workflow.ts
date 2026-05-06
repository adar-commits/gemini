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
    position: [120, 400],
  },
  output: [{ body: { raw_address: "test" }, headers: {} }],
});

const loadReferenceSheet = node({
  type: "n8n-nodes-base.googleSheets",
  version: 4.7,
  config: {
    name: "Load reference sheet",
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
      combineFilters: "AND",
      options: {
        returnAllMatches: "returnAllMatches",
      },
    },
    credentials: {
      googleSheetsOAuth2Api: newCredential("Google Sheets account"),
    },
    alwaysOutputData: true,
    position: [320, 400],
  },
  output: [{ city_name: "תל אביב-יפו", street_name: "הרצל" }],
});

const prepareAgentInput = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Prepare agent input",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: `const webhook = $('Webhook').first().json;
const raw = webhook.body?.raw_address ?? webhook.body ?? '';
const rows = $input.all().map((i) => i.json);
const cityToStreets = {};
for (const r of rows) {
  const c = r.city_name;
  const s = r.street_name ?? r.Street ?? r.street ?? '';
  if (!c || !s) continue;
  if (!cityToStreets[c]) cityToStreets[c] = [];
  if (!cityToStreets[c].includes(s)) cityToStreets[c].push(s);
}
const canonicalCities = Object.keys(cityToStreets);
return [{ json: { raw_address: String(raw), cityToStreets, canonicalCities } }];`,
    },
    position: [520, 400],
  },
  output: [
    {
      json: {
        raw_address: "test",
        cityToStreets: { "תל אביב-יפו": ["הרצל"] },
        canonicalCities: ["תל אביב-יפו"],
      },
    },
  ],
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
    position: [520, 720],
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
    position: [760, 720],
  },
});

const systemMsgHe = `אתה מנתח כתובות משלוח בישראל. השפה של התשובה הפנימית שלך לשדות city ו-street חייבת להיות עברית ולהשתמש רק בערכים מהגיליון.

קלט:
- raw_address: מחרוזת הכתובת הגולמית.
- cityToStreets: אובייקט שבו כל מפתח הוא שם עיר בדיוק כפי שמופיע בעמודה city_name בגיליון, והערך הוא מערך של שמות רחובות מותרים בדיוק כפי שמופיעים בעמודה street_name בגיליון (לכל עיר רק הרחובות שלה).

חוקים אסורים להפרה:
- בשדה city יש להחזיר אחד ממפתחות cityToStreets בלבד, תו-בתו כמו בגיליון — אסור להמציא שם עיר חדש או לשנות איות.
- בשדה street יש להחזיר מחרוזת אחת מתוך המערך cityToStreets[city] בדיוק כפי שמופיע בגיליון — אסור להמציא רחוב או כינוי שלא קיים במערך הזה.

לפני שבחרת עיר ורחוב, נרמל את הקלט הגולמי מנטלית:
- הסר רווחים כפולים, התעלם מפסיקים ומקפים מיותרים סביב מילים.
- זהה קיצורי ערים נפוצים (למשל ת״א, תא, תל־אביב, תל אביב) והתאם לשם העיר המתאים מתוך מפתחות cityToStreets בלבד.
- זהה קיצורים כמו ראשל״צ ומצא את שם העיר המלא המתאים מתוך המפתחות — לא מחוץ לרשימה.

מספר בית, קומה ודירה: חלץ מספרים; בפורמט כמו 4/12 כאשר המספר הגדול הוא מספר הדירה והקטן הוא הקומה.

אם אין לך התאמה ודאית לזוג עיר+רחוב מהרשימות — הגדר confidence_low ל-true ו-confidence_score נמוך (מתחת ל-0.9).

מלא original_input זהה ל-raw_address.`;

const addressAgent = node({
  type: "@n8n/n8n-nodes-langchain.agent",
  version: 3.1,
  config: {
    name: "AI Agent",
    parameters: {
      promptType: "define",
      text: expr(
        "{{ JSON.stringify({ raw_address: $json.raw_address, cityToStreets: $json.cityToStreets, canonicalCities: $json.canonicalCities }) }}"
      ),
      hasOutputParser: true,
      options: {
        systemMessage: systemMsgHe,
        maxIterations: 1,
        returnIntermediateSteps: false,
        enableStreaming: false,
      },
    },
    subnodes: {
      model: openAiChatModel,
      outputParser: structuredParser,
    },
    position: [720, 400],
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
      jsCode: `const agent = $('AI Agent').first().json;
const parsed = agent.output && typeof agent.output === 'object' ? agent.output : agent;
const webhookBody = $('Webhook').first().json.body || {};
const rawInput = String(parsed.original_input || webhookBody.raw_address || '');
const prep = $('Prepare agent input').first().json;
const cityToStreets = prep.cityToStreets || {};

const city = parsed.city;
const street = parsed.street;
const streetsForCity = cityToStreets[city];
const exactCityOk = typeof city === 'string' && Object.prototype.hasOwnProperty.call(cityToStreets, city);
const exactStreetOk = exactCityOk && Array.isArray(streetsForCity) && streetsForCity.includes(street);

let conf = typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0;
let low = parsed.confidence_low === true;
const sheetOk = exactCityOk && exactStreetOk;

if (!sheetOk) {
  low = true;
  conf = Math.min(conf, 0.85);
}

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
    street,
    streetNo: parsed.streetNo,
    floor: floor ?? null,
    apartment: apartment ?? null,
    city,
    original_input: rawInput,
    confidence_score: conf
  }
}];`,
    },
    position: [960, 400],
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
    position: [1200, 400],
  },
});

export default workflow(
  "address-fixer-sheet-first-v1",
  "Address Fixer v2 — shipping parse"
)
  .add(addressWebhook)
  .to(loadReferenceSheet)
  .to(prepareAgentInput)
  .to(addressAgent)
  .to(gatekeeperCode)
  .to(respondWebhook);
