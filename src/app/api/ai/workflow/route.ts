import { NextResponse } from "next/server";
import { generateWorkflowSuggestion } from "@/lib/ai";

type WorkflowRequestBody = {
  prompt?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin":
    process.env.AI_WORKFLOW_ALLOWED_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonWithCors<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: corsHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WorkflowRequestBody;
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return jsonWithCors({ error: "Prompt is required." }, { status: 400 });
    }

    const suggestion = await generateWorkflowSuggestion(prompt);

    return jsonWithCors(
      {
        ok: true,
        suggestion,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AI_WORKFLOW]", error);
    return jsonWithCors(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate workflow suggestion.",
      },
      { status: 500 }
    );
  }
}
