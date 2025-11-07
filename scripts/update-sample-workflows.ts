import fs from "node:fs/promises";
import path from "node:path";

type SampleMeta = {
  id: string;
  title: string;
  description: string;
  problem: string;
  tags: string[];
  file: string;
};

const samples: SampleMeta[] = [
  {
    id: "daily-digest-agent",
    title: "AI Daily Digest Agent",
    description:
      "Aggregates RSS articles, transcripts, and emails into a single Gemini-authored morning digest and sends it to Slack.",
    problem:
      "Knowledge workers spend too much time scanning sources each morning; this agent compiles the highlights automatically.",
    tags: ["ai", "slack", "digest", "rss", "automation"],
    file: "data/workflows/episodes/episode_2_daily_digest.json",
  },
  {
    id: "job-board-linkedin-leadgen",
    title: "LinkedIn + Job Board Lead Generation",
    description:
      "Scrapes fresh job posts, enriches contacts with Gemini, and populates Airtable/Google Sheets for outreach sequences.",
    problem:
      "Manual lead research is slow; this workflow automates sourcing and enrichment for sales and recruiting teams.",
    tags: ["leadgen", "linkedin", "research", "airtable", "sales"],
    file: "data/workflows/episodes/episode_6_linkedin_leadgen.json",
  },
  {
    id: "postiz-social-scheduler",
    title: "Postiz Social Video Scheduler",
    description:
      "Downloads source video, uploads it to Postiz, fetches integrations, and schedules posts for TikTok/YouTube/Instagram.",
    problem:
      "Creators need a repeatable way to share the same asset across multiple channels without logging into each platform.",
    tags: ["social", "postiz", "video", "scheduler"],
    file: "data/workflows/episodes/episode_12_postiz.json",
  },
  {
    id: "reddit-startup-ideas",
    title: "Reddit Startup Idea Miner",
    description:
      "Monitors Reddit threads, summarizes pain points with Gemini, and generates YC-style startup briefs in Notion.",
    problem:
      "Finding validated startup ideas is tedious; this agent mines Reddit discussions and converts them into structured ideas.",
    tags: ["reddit", "startup", "notion", "summaries", "ai"],
    file: "data/workflows/episodes/episode_15_startup_ideas.json",
  },
  {
    id: "linkedin-hitl-writer",
    title: "LinkedIn Content with Human Approval",
    description:
      "Ingests industry news, drafts LinkedIn posts with Gemini, and routes them through a manual approval branch before publishing.",
    problem:
      "Marketing teams want AI-generated posts but insist on a human-in-the-loop signoff to keep messaging on brand.",
    tags: ["linkedin", "content", "approval", "marketing"],
    file: "data/workflows/episodes/episode_3_linkedin_hitl.json",
  },
  {
    id: "google-deep-research",
    title: "Google Programmable Deep Research",
    description:
      "Uses programmable search plus scraping subflows to collect context, summarize sources, and hand results to downstream agents.",
    problem:
      "Analysts need trustworthy research packs before writing; this workflow automates discovery, extraction, and consolidation.",
    tags: ["research", "google", "scraping", "ai"],
    file: "data/workflows/episodes/episode_4_deep_research.json",
  },
  {
    id: "ai-blog-writer",
    title: "AI Blog Writer with Structured Research",
    description:
      "Chains research subworkflows, scrapes supporting links, and generates multi-section blog posts ready for CMS handoff.",
    problem:
      "Content teams struggle to turn raw research into long-form articles; this agent packages insights into publishable drafts.",
    tags: ["blog", "content", "research", "writing"],
    file: "data/workflows/episodes/episode_5_blog_writer.json",
  },
];

async function main() {
  const enriched = await Promise.all(
    samples.map(async (sample) => {
      const absoluteFile = path.resolve(sample.file);
      const workflowJson = JSON.parse(await fs.readFile(absoluteFile, "utf-8"));
      return {
        id: sample.id,
        title: sample.title,
        description: sample.description,
        problem: sample.problem,
        tags: sample.tags,
        workflow: workflowJson,
      };
    })
  );

  const targetPath = path.resolve("data/workflows/sample-workflows.json");
  await fs.writeFile(targetPath, JSON.stringify(enriched, null, 2));
  console.log(
    `Wrote ${enriched.length} curated workflows to ${path.relative(
      process.cwd(),
      targetPath
    )}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
