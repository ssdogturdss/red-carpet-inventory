import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { ScanInventorySheetBody } from "@workspace/api-zod";
import { requireEmployeeAuth } from "../lib/userAuth";

const router = Router();

router.post("/inventory/scan", requireEmployeeAuth, async (req, res) => {
  const parseResult = ScanInventorySheetBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.message });
    return;
  }

  const { imageBase64, chemicals } = parseResult.data;

  const chemicalList = chemicals.map((c) => `- ${c.name} (${c.unit})`).join("\n");

  const prompt = `You are analyzing a handwritten or printed weekly chemical inventory count sheet.

The following chemicals should be on this sheet:
${chemicalList}

Extract the quantity for each chemical from the image. Return a JSON object with this exact structure:
{
  "entries": [
    { "chemicalId": <number>, "chemicalName": "<string>", "quantity": <number>, "confidence": "high"|"medium"|"low" }
  ],
  "rawText": "<all text you can read from the image>"
}

Rules:
- Include ALL chemicals from the list above in entries, even if you cannot find them (use quantity: 0 and confidence: "low")
- Match chemical names case-insensitively
- If a value is illegible, use 0 and confidence "low"
- confidence "high" = clearly readable, "medium" = partially readable, "low" = guessed or not found
- Return ONLY the JSON, no other text`;

  // Model is configurable — set OPENAI_VISION_MODEL to override.
  // Replit AI Integration default: gpt-5.4. Standard OpenAI: gpt-4o.
  const model = process.env.OPENAI_VISION_MODEL ?? "gpt-4o";

  const response = await openai.chat.completions.create({
    model,
    max_completion_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "high",
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";

  let parsed: { entries: Array<{ chemicalId: number; chemicalName: string; quantity: number; confidence: string }>; rawText: string };
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
  } catch {
    req.log.error({ raw }, "Failed to parse AI response");
    res.status(500).json({ error: "Failed to parse AI response" });
    return;
  }

  // Fill in any missing chemicals
  const foundIds = new Set(parsed.entries?.map((e) => e.chemicalId) ?? []);
  const missingChemicals = chemicals.filter((c) => !foundIds.has(c.id));

  const entries = [
    ...(parsed.entries ?? []),
    ...missingChemicals.map((c) => ({
      chemicalId: c.id,
      chemicalName: c.name,
      quantity: 0,
      confidence: "low" as const,
    })),
  ];

  res.json({
    entries,
    rawText: parsed.rawText ?? "",
  });
});

export default router;
