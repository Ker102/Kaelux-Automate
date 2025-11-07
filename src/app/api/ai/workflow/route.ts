import { NextResponse } from "next/server";
import { generateWorkflowSuggestion } from "@/lib/ai";

type WorkflowRequestBody = {
  prompt?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WorkflowRequestBody;
    const prompt = body.prompt?.trim();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required." },
        { status: 400 }
      );
    }

    const suggestion = await generateWorkflowSuggestion(prompt);

    return NextResponse.json(
      {
        ok: true,
        suggestion,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AI_WORKFLOW]", error);
    return NextResponse.json(
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
