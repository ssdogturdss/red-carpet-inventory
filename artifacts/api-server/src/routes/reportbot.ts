import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import PDFDocument from "pdfkit";

const router = Router();

// ─── Admin PIN middleware ─────────────────────────────────────────────────────
function requireAdminPin(req: any, res: any, next: any) {
  const pin = req.headers["x-admin-pin"] as string | undefined;
  const adminPin = process.env.ADMIN_PIN ?? "1234";
  if (!pin || pin !== adminPin) {
    res.status(401).json({ error: "Admin PIN required" });
    return;
  }
  next();
}

// ─── Tool definitions ─────────────────────────────────────────────────────────
const TOOLS: any[] = [
  {
    type: "function",
    function: {
      name: "weekly_usage_by_store",
      description: "Get week-over-week chemical usage change for a specific store or all stores. Returns each chemical's current and previous quantity plus % change.",
      parameters: {
        type: "object",
        properties: {
          storeId: { type: "number", description: "Store ID (omit for all stores)" },
          weekOf: { type: "string", description: "Week date YYYY-MM-DD (omit for latest)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "alerts_history",
      description: "Get alert history — critical and warning anomalies triggered by abnormal chemical usage. Can filter by store.",
      parameters: {
        type: "object",
        properties: {
          storeId: { type: "number", description: "Filter by store ID (omit for all stores)" },
          limit: { type: "number", description: "Max rows to return (default 50)" },
          unacknowledgedOnly: { type: "boolean", description: "Only return unacknowledged alerts" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "store_comparison",
      description: "Compare chemical inventory levels across all stores side-by-side for a given week.",
      parameters: {
        type: "object",
        properties: {
          weekOf: { type: "string", description: "Week date YYYY-MM-DD (omit for latest)" },
          chemicalId: { type: "number", description: "Focus on a specific chemical (omit for all)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "chemical_trend",
      description: "Get the trend (week by week totals) for a specific chemical over the last N weeks.",
      parameters: {
        type: "object",
        required: ["chemicalName"],
        properties: {
          chemicalName: { type: "string", description: "Chemical name (partial match ok)" },
          weeks: { type: "number", description: "Number of weeks to look back (default 8)" },
          storeId: { type: "number", description: "Limit to a specific store (omit for all)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "deliveries_log",
      description: "Get the log of chemical deliveries received by stores.",
      parameters: {
        type: "object",
        properties: {
          storeId: { type: "number", description: "Filter by store ID (omit for all)" },
          limit: { type: "number", description: "Max rows (default 50)" },
          since: { type: "string", description: "Only deliveries on/after this date YYYY-MM-DD" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_stores",
      description: "List all stores with their IDs and names. Call this first when the user mentions a store by name.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_chemicals",
      description: "List all chemicals with their IDs and names. Call this first when the user mentions a chemical by name.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// ─── Tool executors ───────────────────────────────────────────────────────────
async function runTool(name: string, args: any): Promise<any> {
  switch (name) {
    case "list_stores": {
      const r = await db.execute(sql`SELECT id, name, store_number FROM stores ORDER BY name`);
      return r.rows;
    }
    case "list_chemicals": {
      const r = await db.execute(sql`SELECT id, name, unit FROM chemicals ORDER BY name`);
      return r.rows;
    }
    case "weekly_usage_by_store": {
      const storeId: number | null = args.storeId ?? null;
      const weekOf: string | null = args.weekOf ?? null;
      const r = await db.execute(sql`
        WITH sel AS (
          SELECT DISTINCT ON (store_id) id, store_id, week_of
          FROM inventory_counts
          ${weekOf ? sql`WHERE week_of <= ${weekOf}::date` : sql``}
          ORDER BY store_id, week_of DESC
        ),
        prev AS (
          SELECT DISTINCT ON (ic.store_id) ic.id, ic.store_id, ic.week_of
          FROM inventory_counts ic
          JOIN sel ON ic.store_id = sel.store_id
          WHERE ic.week_of < sel.week_of
          ORDER BY ic.store_id, ic.week_of DESC
        )
        SELECT
          s.name AS store_name, s.store_number,
          c.name AS chemical_name, c.unit,
          ie.quantity, pie.quantity AS previous_quantity,
          sel.week_of,
          ROUND(((ie.quantity - pie.quantity)::numeric / NULLIF(pie.quantity,0)) * 100, 1) AS change_pct
        FROM stores s
        ${storeId ? sql`WHERE s.id = ${storeId}` : sql``}
        JOIN sel ON sel.store_id = s.id
        JOIN chemicals c ON true
        LEFT JOIN inventory_entries ie ON ie.count_id = sel.id AND ie.chemical_id = c.id
        LEFT JOIN prev ON prev.store_id = s.id
        LEFT JOIN inventory_entries pie ON pie.count_id = prev.id AND pie.chemical_id = c.id
        ORDER BY s.name, c.name
      `);
      return r.rows;
    }
    case "alerts_history": {
      const storeId: number | null = args.storeId ?? null;
      const limit = Math.min(args.limit ?? 50, 200);
      const unackOnly: boolean = args.unacknowledgedOnly ?? false;
      const r = await db.execute(sql`
        SELECT a.id, s.name AS store_name, c.name AS chemical_name,
          a.week_of, a.previous_quantity, a.current_quantity,
          a.percent_change, a.direction, a.severity, a.acknowledged, a.created_at
        FROM alerts a
        JOIN stores s ON s.id = a.store_id
        JOIN chemicals c ON c.id = a.chemical_id
        ${storeId ? sql`WHERE a.store_id = ${storeId}` : sql``}
        ${unackOnly
          ? storeId
            ? sql`AND a.acknowledged = false`
            : sql`WHERE a.acknowledged = false`
          : sql``}
        ORDER BY a.created_at DESC
        LIMIT ${limit}
      `);
      return r.rows;
    }
    case "store_comparison": {
      const weekOf: string | null = args.weekOf ?? null;
      const chemicalId: number | null = args.chemicalId ?? null;
      const r = await db.execute(sql`
        WITH sel AS (
          SELECT DISTINCT ON (store_id) id, store_id, week_of
          FROM inventory_counts
          ${weekOf ? sql`WHERE week_of <= ${weekOf}::date` : sql``}
          ORDER BY store_id, week_of DESC
        )
        SELECT
          c.name AS chemical_name, c.unit,
          s.name AS store_name, s.store_number,
          ie.quantity, sel.week_of
        FROM chemicals c
        ${chemicalId ? sql`WHERE c.id = ${chemicalId}` : sql``}
        CROSS JOIN stores s
        LEFT JOIN sel ON sel.store_id = s.id
        LEFT JOIN inventory_entries ie ON ie.count_id = sel.id AND ie.chemical_id = c.id
        ORDER BY c.name, s.name
      `);
      return r.rows;
    }
    case "chemical_trend": {
      const chemName: string = args.chemicalName;
      const weeks = Math.min(args.weeks ?? 8, 26);
      const storeId: number | null = args.storeId ?? null;
      const chemRow = await db.execute(sql`
        SELECT id, name FROM chemicals
        WHERE name ILIKE ${"%" + chemName + "%"}
        ORDER BY name LIMIT 1
      `);
      if (!chemRow.rows.length) return { error: `No chemical found matching "${chemName}"` };
      const chem = chemRow.rows[0] as any;
      const r = await db.execute(sql`
        WITH recent AS (
          SELECT ic.week_of,
            COALESCE(SUM(ie.quantity),0)::numeric AS total_quantity,
            COUNT(DISTINCT ic.store_id)::int AS store_count
          FROM inventory_counts ic
          JOIN inventory_entries ie ON ie.count_id = ic.id AND ie.chemical_id = ${chem.id}
          ${storeId ? sql`WHERE ic.store_id = ${storeId}` : sql``}
          GROUP BY ic.week_of
          ORDER BY ic.week_of DESC
          LIMIT ${weeks}
        )
        SELECT * FROM recent ORDER BY week_of ASC
      `);
      return { chemical: chem.name, weeks: r.rows };
    }
    case "deliveries_log": {
      const storeId: number | null = args.storeId ?? null;
      const limit = Math.min(args.limit ?? 50, 200);
      const since: string | null = args.since ?? null;
      const conditions: any[] = [];
      let whereClause = sql``;
      if (storeId && since) {
        whereClause = sql`WHERE ir.store_id = ${storeId} AND ir.received_date >= ${since}::date`;
      } else if (storeId) {
        whereClause = sql`WHERE ir.store_id = ${storeId}`;
      } else if (since) {
        whereClause = sql`WHERE ir.received_date >= ${since}::date`;
      }
      const r = await db.execute(sql`
        SELECT s.name AS store_name, c.name AS chemical_name, c.unit,
          ir.quantity_received, ir.received_date, ir.received_by, ir.po_number, ir.notes
        FROM inventory_received ir
        JOIN stores s ON s.id = ir.store_id
        JOIN chemicals c ON c.id = ir.chemical_id
        ${whereClause}
        ORDER BY ir.received_date DESC
        LIMIT ${limit}
      `);
      return r.rows;
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ─── POST /reports/bot ────────────────────────────────────────────────────────
router.post("/reports/bot", requireAdminPin, async (req, res) => {
  const { message, history = [] } = req.body as {
    message: string;
    history: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!message?.trim()) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const systemPrompt = `You are the Red Carpet Inventory Report Bot — a helpful, professional assistant for a car wash chain with 11 stores tracking 23+ chemicals weekly.

You help managers understand their chemical inventory through natural language. You have access to tools that query live data.

When the user asks for a report, use the appropriate tool(s) to fetch data, then:
1. Write a concise executive summary (2-4 sentences)
2. Highlight the most important findings (top issues, anomalies, trends)
3. Give 1-2 actionable recommendations

Always be specific — mention store names, chemical names, and actual numbers.
If data is missing or a store hasn't submitted, say so clearly.
Keep your tone professional but friendly. You are helping car wash operators make better decisions.

Today's date: ${new Date().toISOString().split("T")[0]}`;

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-10),
    { role: "user", content: message },
  ];

  // Tool-calling loop
  let toolCallData: Array<{ toolName: string; args: any; result: any }> = [];
  let iterations = 0;

  while (iterations < 5) {
    iterations++;
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    if (!choice) break;

    const assistantMsg = choice.message;
    messages.push(assistantMsg);

    if (choice.finish_reason === "tool_calls" && assistantMsg.tool_calls?.length) {
      const toolResults: any[] = [];
      for (const tc of assistantMsg.tool_calls) {
        const args = JSON.parse(tc.function.arguments || "{}");
        const result = await runTool(tc.function.name, args);
        toolCallData.push({ toolName: tc.function.name, args, result });
        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
      messages.push(...toolResults);
    } else {
      // Final text response
      const content = assistantMsg.content ?? "";
      res.json({
        reply: content,
        toolCalls: toolCallData,
        reportData: toolCallData.length ? toolCallData[toolCallData.length - 1]?.result : null,
        reportType: toolCallData.length ? toolCallData[toolCallData.length - 1]?.toolName : null,
      });
      return;
    }
  }

  res.status(500).json({ error: "Could not generate a response. Please try again." });
});

// ─── POST /reports/bot/pdf ────────────────────────────────────────────────────
router.post("/reports/bot/pdf", requireAdminPin, async (req, res) => {
  const { title, summary, toolName, data } = req.body as {
    title: string;
    summary: string;
    toolName: string;
    data: any;
  };

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${title.replace(/[^a-zA-Z0-9\-_]/g, "_")}.pdf"`,
  );

  const doc = new PDFDocument({ margin: 50, size: "LETTER" });
  doc.pipe(res);

  const NAVY = "#0f172a";
  const TEAL = "#0d9488";
  const GRAY = "#64748b";
  const LIGHT = "#f8fafc";
  const RED = "#dc2626";
  const AMBER = "#d97706";
  const GREEN = "#16a34a";

  // ── Header bar ──
  doc.rect(0, 0, doc.page.width, 80).fill(NAVY);
  doc.fontSize(9).fillColor(TEAL).font("Helvetica-Bold")
    .text("RED CARPET INVENTORY", 50, 22, { characterSpacing: 1.5 });
  doc.fontSize(20).fillColor("#ffffff").font("Helvetica-Bold")
    .text(title, 50, 36);
  doc.fontSize(9).fillColor("rgba(255,255,255,0.6)").font("Helvetica")
    .text(`Generated ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`, 50, 62);

  doc.y = 100;

  // ── Summary box ──
  if (summary) {
    doc.rect(50, doc.y, doc.page.width - 100, 2).fill(TEAL);
    doc.y += 10;
    doc.fontSize(11).fillColor(GRAY).font("Helvetica-Bold")
      .text("EXECUTIVE SUMMARY", 50, doc.y, { characterSpacing: 0.8 });
    doc.y += 16;
    doc.fontSize(10).fillColor("#1e293b").font("Helvetica")
      .text(summary, 50, doc.y, { width: doc.page.width - 100, lineGap: 4 });
    doc.y += 20;
  }

  // ── Data table ──
  const rows: any[] = Array.isArray(data) ? data : data?.weeks ?? [];

  if (rows.length > 0) {
    doc.rect(50, doc.y, doc.page.width - 100, 2).fill(TEAL);
    doc.y += 10;
    doc.fontSize(11).fillColor(GRAY).font("Helvetica-Bold")
      .text("DATA", 50, doc.y, { characterSpacing: 0.8 });
    doc.y += 16;

    // Detect columns from first row
    const cols = Object.keys(rows[0]);
    const colWidth = (doc.page.width - 100) / Math.min(cols.length, 6);
    const displayCols = cols.slice(0, 6);

    // Header row
    doc.rect(50, doc.y, doc.page.width - 100, 20).fill(NAVY);
    displayCols.forEach((col, i) => {
      doc.fontSize(8).fillColor("#ffffff").font("Helvetica-Bold")
        .text(col.replace(/_/g, " ").toUpperCase(), 54 + i * colWidth, doc.y + 6, {
          width: colWidth - 4, ellipsis: true,
        });
    });
    doc.y += 20;

    // Data rows
    rows.slice(0, 80).forEach((row, ri) => {
      if (doc.y > doc.page.height - 80) {
        doc.addPage();
        doc.y = 50;
      }
      const bg = ri % 2 === 0 ? "#ffffff" : LIGHT;
      doc.rect(50, doc.y, doc.page.width - 100, 18).fill(bg);

      displayCols.forEach((col, i) => {
        let val = row[col];
        if (val instanceof Date) val = val.toLocaleDateString();
        if (val === null || val === undefined) val = "—";
        const valStr = String(val);

        let color = "#1e293b";
        if (col.includes("severity") || col.includes("direction")) {
          if (valStr === "critical") color = RED;
          else if (valStr === "warning") color = AMBER;
          else if (valStr === "over") color = RED;
          else if (valStr === "under") color = AMBER;
        }
        if (col.includes("change_pct") || col.includes("percent_change")) {
          const num = parseFloat(valStr);
          if (!isNaN(num)) color = num > 0 ? RED : num < 0 ? GREEN : "#1e293b";
        }

        doc.fontSize(8).fillColor(color).font("Helvetica")
          .text(valStr.slice(0, 30), 54 + i * colWidth, doc.y + 5, {
            width: colWidth - 4, ellipsis: true,
          });
      });
      doc.y += 18;
    });

    if (rows.length > 80) {
      doc.y += 8;
      doc.fontSize(9).fillColor(GRAY).font("Helvetica")
        .text(`… and ${rows.length - 80} more rows`, 50);
    }
  }

  // ── Footer ──
  doc.fontSize(8).fillColor(GRAY).font("Helvetica")
    .text(
      `Red Carpet Inventory  •  Confidential  •  ${new Date().toLocaleDateString()}`,
      50,
      doc.page.height - 40,
      { align: "center", width: doc.page.width - 100 },
    );

  doc.end();
});

export default router;
