import { NextResponse } from "next/server";
import { getPromptExamples } from "@/lib/sample-prompts";

const corsHeaders = new Headers({
  "Access-Control-Allow-Origin":
    process.env.AI_WORKFLOW_ALLOWED_ORIGIN ?? "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const prompts = getPromptExamples(
    Number.isNaN(limit) ? undefined : limit
  );

  return applyCors(
    NextResponse.json({
      prompts,
      count: prompts.length,
    })
  );
}
