import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-pro-exp";

if (!GEMINI_API_KEY) {
  // Fail fast during boot; runtime route will surface a 500 with a clearer message.
  console.warn(
    "[AI] Missing GEMINI_API_KEY. Add it to your environment to enable the AI workflow endpoint."
  );
}

const genAI = GEMINI_API_KEY
  ? new GoogleGenerativeAI(GEMINI_API_KEY)
  : undefined;

const systemInstruction = `
You are an assistant that converts natural language automation requests into n8n workflow JSON.
Always respond with valid JSON that fits the following TypeScript interface:
type AiWorkflowSuggestion = {
  summary: string;
  workflow: object; // valid n8n workflow JSON
  notes?: string[];
};
Do not wrap the JSON in markdown fences. Keep the response short but accurate.
`;

export type AiWorkflowSuggestion = {
  summary: string;
  workflow: unknown;
  notes?: string[];
  rawText: string;
};

export async function generateWorkflowSuggestion(
  prompt: string
): Promise<AiWorkflowSuggestion> {
  if (!genAI) {
    throw new Error(
      "Gemini is not configured. Add GEMINI_API_KEY to enable this feature."
    );
  }

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
  });

  const generation = await model.generateContent([
    {
      role: "user",
      parts: [
        {
          text: `Produce an n8n workflow for the following request:\n"""${prompt}"""`,
        },
      ],
    },
  ]);

  const rawText = generation.response.text().trim();

  try {
    const parsed = JSON.parse(rawText) as {
      summary: string;
      workflow: unknown;
      notes?: string[];
    };

    return {
      summary: parsed.summary ?? "Suggested workflow",
      workflow: parsed.workflow ?? {},
      notes: parsed.notes,
      rawText,
    };
  } catch {
    return {
      summary: "AI response (unparsed)",
      workflow: {},
      rawText,
      notes: [
        "Unable to parse Gemini response. Please review the rawText payload.",
      ],
    };
  }
}
