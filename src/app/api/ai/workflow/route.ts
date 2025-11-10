import { NextResponse } from "next/server";
import { generateWorkflowSuggestion } from "@/lib/ai";

type WorkflowRequestBody = {
  prompt?: string;
};

const corsHeaders = new Headers({
  "Access-Control-Allow-Origin":
    process.env.AI_WORKFLOW_ALLOWED_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
});

function applyCors<T extends NextResponse>(response: T): T {
  corsHeaders.forEach((value, key) => {
    response.headers.set(key, value);
  });
  return response;
}

export async function OPTIONS() {
  return applyCors(new NextResponse(null, { status: 204 }));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WorkflowRequestBody;
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return applyCors(
        NextResponse.json({ error: "Prompt is required." }, { status: 400 })
      );
    }

    const suggestion = await generateWorkflowSuggestion(prompt);

    return applyCors(
      NextResponse.json(
        {
          ok: true,
          suggestion,
        },
        { status: 200 }
      )
    );
  } catch (error) {
    console.error("[AI_WORKFLOW]", error);
    return applyCors(
      NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to generate workflow suggestion.",
        },
        { status: 500 }
      )
    );
  }
}
