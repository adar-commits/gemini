import { getAgentSupabase } from "@/lib/agents/supabase"

export type QaInsightCategory = "api" | "runtime" | "routing" | "agent" | "infra"

export type QaInsightPriority = "critical" | "high" | "medium" | "low"

export type QaInsightEffort = "S" | "M" | "L" | "XL"

export type QaDevelopmentInsight = {
  id: string
  category: QaInsightCategory
  priority: QaInsightPriority
  title: string
  problem: string
  recommendation: string
  effort: QaInsightEffort
  files: string[]
  /** When set, live user-message scan can attach a count to this insight. */
  signalKey?: keyof MessageInsightSignals
}

export type MessageInsightSignals = {
  scanDays: number
  userMessagesScanned: number
  rcReceiptMentions: number
  invoiceDocMentions: number
  hashOrderMentions: number
  soOrderMentions: number
  bareDigitOrderMentions: number
}

export type EnrichedDevelopmentInsight = QaDevelopmentInsight & {
  signalCount: number | null
  qaFailureMentions: number
  score: number
}

const RC_RECEIPT_RE = /\bRC\s*\d{3,}\b/i
const INVOICE_DOC_RE = /\b(?:IN|OV)\s*\d{3,}\b/i
const HASH_ORDER_RE = /#\s*\d{5}\b/
const SO_ORDER_RE = /\bSO\s*\d{3,}\b/i
const BARE_ORDER_RE = /\b(?:ה)?זמנ(?:ה|ות)\s*(?:#|מס(?:'|׳|"|')?\s*)?\d{4,8}\b/i

/** Curated backlog — edit here when architecture gaps are discovered. */
export const QA_DEVELOPMENT_INSIGHTS: QaDevelopmentInsight[] = [
  {
    id: "priority-api-document-lookup",
    category: "api",
    priority: "critical",
    title: "חיפוש הזמנה לפי RC / IN / OV / ON — לא רק לפי טלפון",
    problem:
      "היום getOrders ב-n8n מחזיר הזמנות לפי טלפון בלבד. לקוחות שולחים RC (קבלה), IN/OV (חשבונית) או ON — הבוט מזהה את המספר בטקסט, אבל מוצא הזמנה רק אם המסמך כבר מופיע ב-JSON של אחת מההזמנות של אותו טלפון (findOrderByDocumentReference). אם ההזמנה על טלפון אחר — נכשל.",
    recommendation:
      "הרחב את webhook Priority: actionType חדש (למשל getOrderByReference) שמקבל RC*, IN*, OV*, ON*, ORDNAME (SO…), REFERENCE (#89535) ומחזיר שורת הזמנה + ORDNAME. אחר כך ב-order-lookup.ts: כשextractOrderReference נכשל על רשימת הטלפון — קרא API ישירות לפי המסמך.",
    effort: "L",
    files: ["lib/agents/priority-webhook.ts", "lib/agents/order-lookup.ts", "n8n Priority workflow"],
    signalKey: "rcReceiptMentions",
  },
  {
    id: "priority-api-invoice-not-ordname",
    category: "api",
    priority: "high",
    title: "IN/OV בטקסט ≠ מספר הזמנה — צריך resolve ל-ORDNAME",
    problem:
      "extractOrderNumber תופס IN/OV כמו SO, אבל ב-Priority אלה מזהי חשבונית/מסמך. lookupOrderByReference מחפש התאמה ברשימת getOrders — לעיתים אין התאמה למרות שהמסמך תקין.",
    recommendation:
      "ב-API: IN12345 → ORDNAME. בצד הבוט: אחרי resolve, המשך confirm/status כרגיל. אל תניח ש-IN/OV הוא orderNumber.",
    effort: "M",
    files: ["lib/agents/order-lookup.ts", "n8n Priority workflow"],
    signalKey: "invoiceDocMentions",
  },
  {
    id: "session-stale-history-window",
    category: "runtime",
    priority: "high",
    title: "חלון 15 הודעות — ללא cutoff זמן (חזרה אחרי חודשים)",
    problem:
      "getConversationContext טוען 15 ההודעות האחרונות לפי created_at בלבד. inactivity close לא מוחק הודעות ולא מגדיר reset_at. לקוח שחוזר אחרי חצי שנה — הבוט רואה שיחת מכירות/שירות ישנה ומחייב pending states אליה.",
    recommendation:
      "ב-handle-inbound כשפותחים thread אחרי inactivity: אם gap > N ימים — reset רך (נקה conversation_summary, אופצионלי reset_at / session_epoch). structured detectors י bound רק מתוך epoch נוכחי.",
    effort: "M",
    files: [
      "lib/agents/memory.ts",
      "lib/hom-agent/handle-inbound.ts",
      "lib/agents/inactivity-session.ts",
    ],
  },
  {
    id: "session-summary-stale",
    category: "runtime",
    priority: "high",
    title: "conversation_summary נשמר חודשים — מוזרק ל-system prompt",
    problem:
      "maybeRefreshConversationSummary מעדכן summary כל 5 תורות; הוא נשמר ב-hom_agent_sessions עד reset מפורש. summary ישן עלול לטעות את ה-LLM גם כשההודעות האחרונות כבר לא רלוונטיות.",
    recommendation:
      "נקה summary ב-inactivity reopen / session split. שקול TTL (למשל 7 ימים) או regenerate מהודעות post-gap בלבד.",
    effort: "S",
    files: ["lib/agents/session-summary.ts", "lib/agents/memory.ts"],
  },
  {
    id: "sales-intake-sticky-markers",
    category: "routing",
    priority: "medium",
    title: "שאלון מכירות \"דביק\" — סורק 15 הודעות אחורה",
    problem:
      "hasOngoingSalesIntake() מחפש INTAKE_MARKER_RE בכל history. שיחה ישנה עם \"מה התקציב\" גורמת לבוט לחשוב שאלון מכירות פעיל גם בפנייה חדשה על משלוח/שירות.",
    recommendation:
      "קשר intake ל-session_epoch או timestamp של תחילת quiz; ignore markers לפני gap / reset. חלופה: flag ב-hom_agent_sessions (sales_intake_active).",
    effort: "M",
    files: ["lib/agents/sales-intake.ts", "lib/hom-agent/conversation-hints.ts"],
  },
  {
    id: "pending-state-ttl",
    category: "routing",
    priority: "medium",
    title: "Pending states (confirm / handoff) ללא TTL",
    problem:
      "isOrderConfirmationPending, isHumanHandoffPending וכו' נשענים על שאלת הבוט האחרונה ב-history — גם אם מלפני חודשים. \"כן\" / \"כן תודה\" עלול להיקשר להצעת handoff ישנה.",
    recommendation:
      "הוסף מרווח זמן מקסימום מ-bot question (למשל 48h) או invalidate pending ב-session reopen. pre-turn י skip כשפג תוקף.",
    effort: "M",
    files: ["lib/hom-agent/pre-turn.ts", "lib/agents/order-lookup.ts", "lib/agents/compound-reply.ts"],
  },
  {
    id: "rc-document-vs-reference",
    category: "routing",
    priority: "medium",
    title: "RC — בקשת עותק מסמך מול \"זו הקבלה שלי\"",
    problem:
      "אותה מילה \"קבלה\" / RC: לפעמים בקשה ל-PDF, לפעמים זיהוי הזמנה. document pre-turn ו-order lookup מתחרים; defer קיים אבל לא מכסה הכל.",
    recommendation:
      "עם API document→order: RC ב-thread משלוח → lookup ישיר. RC + \"שלחו\" / \"עותק\" → document flow. הוסף fixture לכל זוג.",
    effort: "M",
    files: [
      "lib/agents/digital-document-flow.ts",
      "lib/agents/order-lookup.ts",
      "lib/hom-agent/prompts/hom-bot.md",
    ],
    signalKey: "rcReceiptMentions",
  },
  {
    id: "order-formats-on-prefix",
    category: "api",
    priority: "medium",
    title: "תמיכה ב-ON ופורמטים נוספים של Priority",
    problem:
      "extractOrderNumber תומך SO/IN/OV + #12345 + ספרות בלבד. ON (אם קיים ב-Priority) ופורמטים נוספים לא נתמכים — לקוח נתקע ב\"לא מצאתי\".",
    recommendation:
      "מפה מול Priority את כל prefix-ים פעילים (SO, ON, …). הרחב regex + דוגמאות ב-ORDER_NUMBER_ASK_EXAMPLES. API unified lookup (ראה insight document-lookup).",
    effort: "S",
    files: ["lib/agents/order-lookup.ts", "n8n Priority workflow"],
    signalKey: "soOrderMentions",
  },
  {
    id: "alternate-phone-dead-end",
    category: "agent",
    priority: "medium",
    title: "הזמנה לא על הטלפון — אין נתיב מסמך בלי API",
    problem:
      "כשההזמנה לא ברשימת getOrders, הבוט מבקש טלפון חלופי או מספר הזמנה — אבל RC/IN שהלקוח כבר שלח לא מספיקים בלי API resolve.",
    recommendation:
      "אחרי priority-api-document-lookup: לפני alternate-phone prompt, נסה lookup לפי המסמך שכבר ב-thread. הורד לoop של confirm טלפון.",
    effort: "M",
    files: ["lib/agents/order-lookup.ts"],
    signalKey: "rcReceiptMentions",
  },
  {
    id: "llm-history-pollution",
    category: "agent",
    priority: "medium",
    title: "ה-LLM רואה היסטוריה ישנה — רק הנחיה, לא בידוד",
    problem:
      "hom-bot.md מלמד \"בקשה אחרונה גוברת\" — אבל structured code + summary + lastAgent עדיין מושפעים. שילוב גורם למסלולים שגויים גם כשה-LLM \"יודע\".",
    recommendation:
      "שלב session reset (runtime insights) + turn hint מפורש כשמזהים gap: NEW SESSION — ignore pre-gap history for routing.",
    effort: "S",
    files: ["lib/hom-agent/prompts/hom-bot.md", "lib/hom-agent/conversation-hints.ts"],
  },
  {
    id: "violation-scanner-dashboard",
    category: "infra",
    priority: "low",
    title: "Violation scanner — לא מחובר לדשבורד",
    problem:
      "lib/hom-agent/violation-scanner.ts סורק hom_agent_messages ל-transfer/action mismatch, document-on-shipping וכו' — רץ ידנית / automation, לא מוצג כ-KPI.",
    recommendation:
      "Cron יומי → שמור counts בטבלה / הצג כרטיס ב-QA: \"הפרות בשבוע\" + קישור לשיחות. מזין תובנות חדשות אוטומטית.",
    effort: "M",
    files: ["lib/hom-agent/violation-scanner.ts", "app/dashboard/qa/page.tsx"],
  },
  {
    id: "history-limit-tuning",
    category: "runtime",
    priority: "low",
    title: "history_limit=15 — configurable אבל לא per-flow",
    problem:
      "hom_agent_runtime_config.history_limit שולט בכל הזרימות. שירות צריך הקשר קצר; מכירות ארוכה — 15 עלול להיות מעט או הרבה מדי.",
    recommendation:
      "שקול limit per agent (sales 20, service 10) או trim חכם (רק post-confirm lines) — אחרי session epoch.",
    effort: "M",
    files: ["lib/agents/memory.ts", "lib/agent-core/runtime-config.ts"],
  },
  {
    id: "get-document-without-order",
    category: "api",
    priority: "low",
    title: "getDocument דורש order מזוהה — לא standalone לפי RC",
    problem:
      "getDocument ב-n8n מקבל value + documentType אחרי שהזמנה כבר ידועה. לקוח עם RC בלבד לא מקבל PDF עד שמזהים ORDNAME.",
    recommendation:
      "שרשר: getOrderByReference(RC) → ORDNAME → getDocument. או endpoint אחד getDocumentByNumber(RC).",
    effort: "M",
    files: ["lib/agents/digital-document-flow.ts", "lib/agents/order-lookup.ts"],
    signalKey: "rcReceiptMentions",
  },
]

const CATEGORY_LABELS: Record<QaInsightCategory, string> = {
  api: "Priority / API",
  runtime: "Runtime / Session",
  routing: "Routing / Structured",
  agent: "LLM / Prompt",
  infra: "תשתית QA",
}

const PRIORITY_LABELS: Record<QaInsightPriority, string> = {
  critical: "קריטי",
  high: "גבוה",
  medium: "בינוני",
  low: "נמוך",
}

const PRIORITY_WEIGHT: Record<QaInsightPriority, number> = {
  critical: 400,
  high: 300,
  medium: 200,
  low: 100,
}

export function qaInsightCategoryLabel(category: QaInsightCategory) {
  return CATEGORY_LABELS[category]
}

export function qaInsightPriorityLabel(priority: QaInsightPriority) {
  return PRIORITY_LABELS[priority]
}

export function countMessageInsightSignals(
  contents: string[],
  scanDays: number
): MessageInsightSignals {
  let rcReceiptMentions = 0
  let invoiceDocMentions = 0
  let hashOrderMentions = 0
  let soOrderMentions = 0
  let bareDigitOrderMentions = 0

  for (const raw of contents) {
    const text = raw.trim()
    if (!text) continue
    if (RC_RECEIPT_RE.test(text)) rcReceiptMentions += 1
    if (INVOICE_DOC_RE.test(text)) invoiceDocMentions += 1
    if (HASH_ORDER_RE.test(text)) hashOrderMentions += 1
    if (SO_ORDER_RE.test(text)) soOrderMentions += 1
    if (BARE_ORDER_RE.test(text)) bareDigitOrderMentions += 1
  }

  return {
    scanDays,
    userMessagesScanned: contents.length,
    rcReceiptMentions,
    invoiceDocMentions,
    hashOrderMentions,
    soOrderMentions,
    bareDigitOrderMentions,
  }
}

export async function scanUserMessageSignals(scanDays = 7): Promise<MessageInsightSignals> {
  const since = new Date(Date.now() - scanDays * 86400000).toISOString()
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_messages")
    .select("content")
    .eq("role", "user")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(3000)

  if (error) throw error
  const contents = (data ?? [])
    .map((row) => (typeof row.content === "string" ? row.content : ""))
    .filter(Boolean)

  return countMessageInsightSignals(contents, scanDays)
}

const QA_FAILURE_OUTCOMES = new Set(["real_failure", "failed_guard", "chained"])

export async function aggregateQaFailureThemes(days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString()
  const supabase = getAgentSupabase()
  const { data, error } = await supabase
    .from("hom_agent_qa_runs")
    .select("root_cause, fix_layer, outcome, verdict")
    .gte("created_at", since)
    .in("outcome", [...QA_FAILURE_OUTCOMES])

  if (error) throw error

  const themeCounts = new Map<string, number>()
  for (const row of data ?? []) {
    const blob = [row.root_cause, row.verdict, row.fix_layer]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .join(" ")
      .toLowerCase()
    if (!blob) continue

    if (/rc|קבלה|receipt/i.test(blob)) {
      themeCounts.set("rc-document-vs-reference", (themeCounts.get("rc-document-vs-reference") ?? 0) + 1)
      themeCounts.set("priority-api-document-lookup", (themeCounts.get("priority-api-document-lookup") ?? 0) + 1)
    }
    if (/order|הזמנ|lookup|confirm/i.test(blob)) {
      themeCounts.set("pending-state-ttl", (themeCounts.get("pending-state-ttl") ?? 0) + 1)
    }
    if (/sales|intake|quiz|מכיר/i.test(blob)) {
      themeCounts.set("sales-intake-sticky-markers", (themeCounts.get("sales-intake-sticky-markers") ?? 0) + 1)
    }
    if (/handoff|מעביר|human_/i.test(blob)) {
      themeCounts.set("pending-state-ttl", (themeCounts.get("pending-state-ttl") ?? 0) + 1)
    }
    if (/document|מסמך|invoice|חשבונ/i.test(blob)) {
      themeCounts.set("priority-api-invoice-not-ordname", (themeCounts.get("priority-api-invoice-not-ordname") ?? 0) + 1)
    }
    if (/shipping|משלוח|status/i.test(blob)) {
      themeCounts.set("llm-history-pollution", (themeCounts.get("llm-history-pollution") ?? 0) + 1)
    }
  }

  return { days, themeCounts }
}

export function enrichDevelopmentInsights(
  insights: QaDevelopmentInsight[],
  signals: MessageInsightSignals,
  themeCounts: Map<string, number>
): EnrichedDevelopmentInsight[] {
  return insights
    .map((insight) => {
      const signalCount =
        insight.signalKey != null ? signals[insight.signalKey] : null
      const qaFailureMentions = themeCounts.get(insight.id) ?? 0
      const score =
        PRIORITY_WEIGHT[insight.priority] +
        (signalCount ?? 0) * 3 +
        qaFailureMentions * 8
      return { ...insight, signalCount, qaFailureMentions, score }
    })
    .sort((a, b) => b.score - a.score)
}

export async function getQaDevelopmentInsights(input?: {
  messageScanDays?: number
  qaThemeDays?: number
}) {
  const messageScanDays = input?.messageScanDays ?? 7
  const qaThemeDays = input?.qaThemeDays ?? 30

  const [signals, qaThemes] = await Promise.all([
    scanUserMessageSignals(messageScanDays).catch(() =>
      countMessageInsightSignals([], messageScanDays)
    ),
    aggregateQaFailureThemes(qaThemeDays).catch(() => ({
      days: qaThemeDays,
      themeCounts: new Map<string, number>(),
    })),
  ])

  const insights = enrichDevelopmentInsights(
    QA_DEVELOPMENT_INSIGHTS,
    signals,
    qaThemes.themeCounts
  )

  return {
    signals,
    qaThemeDays: qaThemes.days,
    insights,
  }
}
