import {
  workflow,
  node,
  trigger,
  languageModel,
  outputParser,
  expr,
  newCredential,
  merge,
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

const loadStreetsSheet = node({
  type: "n8n-nodes-base.googleSheets",
  version: 4.7,
  config: {
    name: "Load streets sheet",
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
    position: [320, 280],
  },
  output: [{ city_name: "תל אביב-יפו", street_name: "הרצל" }],
});

const loadSynonymsSheet = node({
  type: "n8n-nodes-base.googleSheets",
  version: 4.7,
  config: {
    name: "Load synonyms sheet",
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
        value: "Sheet2",
        cachedResultName: "Sheet2",
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
    position: [320, 520],
  },
  output: [{ city_name: "תל אביב", city_synonyms: "ת״א" }],
});

const collapseStreets = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Collapse streets rows",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: `return [{ json: { streetRows: $input.all().map((i) => i.json) } }];`,
    },
    position: [440, 280],
  },
  output: [{ json: { streetRows: [] } }],
});

const collapseSynonyms = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Collapse synonym rows",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: `return [{ json: { synonymRows: $input.all().map((i) => i.json) } }];`,
    },
    position: [440, 520],
  },
  output: [{ json: { synonymRows: [] } }],
});

const mergedSheets = merge({
  version: 3.2,
  config: {
    name: "Merge street + synonym sheets",
    parameters: {
      mode: "combine",
      combineBy: "combineByPosition",
    },
    position: [560, 400],
  },
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
const m = $input.first().json;
const streetRows = m.streetRows || [];
const synonymRows = m.synonymRows || [];

const cityToStreets = {};
for (const r of streetRows) {
  const c = r.city_name;
  const s = r.street_name ?? r.Street ?? r.street ?? '';
  if (!c || !s) continue;
  if (!cityToStreets[c]) cityToStreets[c] = [];
  if (!cityToStreets[c].includes(s)) cityToStreets[c].push(s);
}
const canonicalCities = Object.keys(cityToStreets);

const synonymByCity = {};
const existingSynonymKeys = [];
for (const r of synonymRows) {
  const c = r.city_name;
  const s = r.city_synonyms ?? r.city_synonym ?? '';
  if (!c || !s) continue;
  const syn = String(s).trim();
  if (!syn) continue;
  if (!synonymByCity[c]) synonymByCity[c] = [];
  if (!synonymByCity[c].includes(syn)) synonymByCity[c].push(syn);
  existingSynonymKeys.push(c + '\\t' + syn);
}

const synonymTableLines = [];
for (const r of synonymRows) {
  const c = r.city_name;
  const syn = String(r.city_synonyms ?? r.city_synonym ?? '').trim();
  if (!c || !syn) continue;
  synonymTableLines.push(c + ': ' + syn);
}
const synonymTableText = synonymTableLines.join('\\n');

const existingSynonymTexts = [];
for (const r of synonymRows) {
  const syn = String(r.city_synonyms ?? r.city_synonym ?? '').trim();
  if (syn) existingSynonymTexts.push(syn);
}

return [{
  json: {
    raw_address: String(raw),
    cityToStreets,
    canonicalCities,
    synonymByCity,
    existingSynonymKeys,
    existingSynonymTexts,
    synonymTableText,
  },
}];`,
    },
    position: [680, 400],
  },
  output: [
    {
      json: {
        raw_address: "test",
        cityToStreets: { "תל אביב-יפו": ["הרצל"] },
        canonicalCities: ["תל אביב-יפו"],
        synonymByCity: { "תל אביב": ["ת״א"] },
        existingSynonymKeys: ["תל אביב\tת״א"],
        existingSynonymTexts: ["ת״א"],
        synonymTableText: "תל אביב: ת״א",
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
    position: [680, 720],
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
        synonym_append_requests: [],
      }),
    },
    position: [920, 720],
  },
});

const systemMsgHe = `אתה מנתח כתובות משלוח בישראל. השפה של התשובה הפנימית שלך לשדות city ו-street חייבת להיות עברית ולהשתמש רק בערכים מהגיליון.

קלט:
- raw_address: מחרוזת הכתובת הגולמית.
- cityToStreets: אובייקט שבו כל מפתח הוא שם עיר בדיוק כפי שמופיע בעמודה city_name בגיליון Sheet1, והערך הוא מערך של שמות רחובות מותרים בדיוק כפי שמופיעים בעמודה street_name (לכל עיר רק הרחובות שלה).
- synonymByCity, synonymTableText ו-existingSynonymTexts: כינויים וקיצורים מגיליון Sheet2 (עמודות city_name, city_synonyms). synonymTableText הוא רשימת כל השורות מהגיליון לקריאה; city בעמודה city_name ב-Sheet2 עשוי להיות קצר/שונה ממפתח העיר ב-Sheet1 — עדיין השתמש בכינויים כדי להבין את הקלט, אבל בשדה city בפלט חייב להופיע רק מפתח מ-cityToStreets (Sheet1).

חוקים אסורים להפרה:
- בשדה city יש להחזיר אחד ממפתחות cityToStreets בלבד, תו-בתו כמו בגיליון Sheet1 — אסור להמציא שם עיר חדש או לשנות איות.
- בשדה street יש להחזיר מחרוזת אחת מתוך המערך cityToStreets[city] בדיוק כפי שמופיע בגיליון — אסור להמציא רחוב או כינוי שלא קיים במערך הזה.

synonym_append_requests (מערך אובייקטים, יכול להיות ריק):
- אחרי שבחרת city סופי מתוך מפתחות cityToStreets, אם בקלט הגולמי הופיע כינוי/קיצור של עיר שהוא לא מופיע עדיין ב-Sheet2 עבור אותה עיר (כלומר אין צמד city_name+city_synonyms מתאים בנתוני synonymByCity / synonymTableText), תוכל להציע שורה חדשה: city_name חייב להיות בדיוק שם העיר הקנוני כפי שבחרת לשדה city (מפתח מ-cityToStreets), ו-city_synonyms הכינוי החדש כפי שהופיע בקלט (נירמול קל של רווחים בלבד).
- אל תציע כפילויות: אם הכינוי כבר מופיע ב-existingSynonymTexts או שהצמד כבר קיים ב-existingSynonymKeys — אל תכלול.
- אם אין כינוי חדש להוסיף — החזר מערך ריק.

לפני שבחרת עיר ורחוב, נרמל את הקלט הגולמי מנטלית:
- הסר רווחים כפולים, התעלם מפסיקים ומקפים מיותרים סביב מילים.
- השתמש ב-synonymTableText ובמפתחות cityToStreets יחד כדי ליישר קיצורים (ת״א, תא, ראשל״צ וכו') לשם העיר הנכון מהמפתחות — לא מחוץ לרשימה.

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
        "{{ JSON.stringify({ raw_address: $json.raw_address, cityToStreets: $json.cityToStreets, canonicalCities: $json.canonicalCities, synonymByCity: $json.synonymByCity, synonymTableText: $json.synonymTableText, existingSynonymKeys: $json.existingSynonymKeys, existingSynonymTexts: $json.existingSynonymTexts }) }}"
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
    position: [880, 400],
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
        synonym_append_requests: [],
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
    position: [1120, 400],
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

const queueSynonymAppends = node({
  type: "n8n-nodes-base.code",
  version: 2,
  config: {
    name: "Queue synonym appends",
    parameters: {
      mode: "runOnceForAllItems",
      language: "javaScript",
      jsCode: `const agent = $('AI Agent').first().json;
const parsed = agent.output && typeof agent.output === 'object' ? agent.output : agent;
const prep = $('Prepare agent input').first().json;
const existingSynonymKeys = new Set(prep.existingSynonymKeys || []);
const existingSynonymTexts = new Set(prep.existingSynonymTexts || []);
const canonicalFromSheet = prep.canonicalCities || [];

function norm(s) {
  return String(s || '').trim();
}

const reqs = Array.isArray(parsed.synonym_append_requests) ? parsed.synonym_append_requests : [];
const out = [];
for (const r of reqs) {
  const city = norm(r.city_name);
  const syn = norm(r.city_synonyms);
  if (!city || !syn) continue;
  if (!canonicalFromSheet.includes(city)) continue;
  const key = city + '\\t' + syn;
  if (existingSynonymKeys.has(key)) continue;
  if (existingSynonymTexts.has(syn)) continue;
  out.push({ json: { city_name: city, city_synonyms: syn } });
}
return out;`,
    },
    position: [1280, 560],
  },
  output: [{ json: { city_name: "תל אביב-יפו", city_synonyms: "תא" } }],
});

const appendSynonymsSheet = node({
  type: "n8n-nodes-base.googleSheets",
  version: 4.7,
  config: {
    name: "Append rows to Sheet2",
    parameters: {
      resource: "sheet",
      operation: "append",
      documentId: {
        __rl: true,
        mode: "list",
        value: "1eVFTSrsMQd-4KF7lcHP7AtANseNSLVaA-Sj5O3x_Gl0",
        cachedResultName: "Goverment Cities",
      },
      sheetName: {
        __rl: true,
        mode: "list",
        value: "Sheet2",
        cachedResultName: "Sheet2",
      },
      columns: {
        mappingMode: "defineBelow",
        value: {
          city_name: "={{ $json.city_name }}",
          city_synonyms: "={{ $json.city_synonyms }}",
        },
      },
      options: {},
    },
    credentials: {
      googleSheetsOAuth2Api: newCredential("Google Sheets account"),
    },
    position: [1480, 560],
  },
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
    position: [1400, 400],
  },
});

export default workflow(
  "address-fixer-sheet-first-v2",
  "Address Fixer v2 — Sheet1+Sheet2 synonyms"
)
  .add(addressWebhook)
  .to(loadStreetsSheet.to(collapseStreets.to(mergedSheets.input(0))))
  .add(addressWebhook)
  .to(loadSynonymsSheet.to(collapseSynonyms.to(mergedSheets.input(1))))
  .add(mergedSheets)
  .to(prepareAgentInput)
  .to(addressAgent)
  .to(
    gatekeeperCode.to([
      respondWebhook,
      queueSynonymAppends.to(appendSynonymsSheet),
    ])
  );
