import { NextResponse } from "next/server";
import { getPromptExamples } from "@/lib/sample-prompts";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Number.parseInt(searchParams.get("limit") ?? "", 10);
  const prompts = getPromptExamples(
    Number.isNaN(limit) ? undefined : limit
  );

  return NextResponse.json({
    prompts,
    count: prompts.length,
  });
}
