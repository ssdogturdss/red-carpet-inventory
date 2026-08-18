import OpenAI from "openai";

// Support both Replit AI Integrations proxy (AI_INTEGRATIONS_OPENAI_*) and
// standard OpenAI credentials (OPENAI_API_KEY / OPENAI_BASE_URL).
// Replit-managed variables take precedence when both are present.
const apiKey =
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
const baseURL =
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? process.env.OPENAI_BASE_URL;

if (!apiKey) {
  throw new Error(
    "No OpenAI API key found. Set OPENAI_API_KEY (standard) or AI_INTEGRATIONS_OPENAI_API_KEY (Replit AI Integration).",
  );
}

export const openai = new OpenAI({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});
