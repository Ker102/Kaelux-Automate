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
  {
    id: "shopify-product-videos",
    title: "Shopify Product Video Factory",
    description:
      "Collects Shopify catalog data, feeds prompts into Seedance + Fal/Latentsync, and assembles talking avatar product videos.",
    problem:
      "Merchants want consistent video assets for ads and PDPs but can’t produce them manually for every SKU.",
    tags: ["shopify", "video", "fal", "seedance", "commerce"],
    file: "data/workflows/episodes/episode_17_shopify_videos.json",
  },
  {
    id: "scary-story-tiktok",
    title: "Scary Story TikTok Generator",
    description:
      "Scrapes Reddit horror prompts, writes scripts with Gemini, renders scenes with Together AI, and posts short-form videos.",
    problem:
      "Faceless YouTube/TikTok channels need a constant stream of spooky stories without writing or editing each clip.",
    tags: ["tiktok", "reddit", "video", "horror", "fal"],
    file: "data/workflows/episodes/episode_18_scary_tiktok.json",
  },
  {
    id: "wan-text-to-video",
    title: "Wan 2.2 Text-to-Video Launcher",
    description:
      "Wraps Modal + ComfyUI endpoints to trigger Wan 2.2 video renders from text prompts and retrieve resulting clips.",
    problem:
      "Creators want to experiment with Wan 2.2 without manual API calls; this workflow automates job submission and retrieval.",
    tags: ["video", "modal", "comfyui", "wan", "ai"],
    file: "data/workflows/episodes/episode_20_wan_t2v.json",
  },
  {
    id: "sleep-music-longform",
    title: "Sleep Music Long-form Creator",
    description:
      "Combines GPT-5 scripts, ElevenLabs music, seed scenes, and editing logic to output hour-long sleep tracks ready for YouTube.",
    problem:
      "Sleep-music channels struggle to produce long videos daily; this flow automates narration, visuals, and audio blending.",
    tags: ["sleep", "music", "youtube", "ai", "longform"],
    file: "data/workflows/episodes/episode_22_sleep_music.json",
  },
  {
    id: "ugc-nanobanana",
    title: "UGC Ads with Nanobanana",
    description:
      "Generates UGC-style ad scenes using Google nanobanana, ElevenLabs, and Seedance, then stitches them into paid media assets.",
    problem:
      "Brands need UGC ads fast but real creator shoots are expensive; this agent fabricates them programmatically.",
    tags: ["ugc", "ads", "nanobanana", "seedance", "marketing"],
    file: "data/workflows/episodes/episode_23_ugc_nanobanana.json",
  },
  {
    id: "influencer-machine",
    title: "Instagram Influencer Machine",
    description:
      "Plans weekly content, generates captions/images via Fal.ai, stores schedules in DB tables, and posts to Instagram Business accounts.",
    problem:
      "AI influencer brands need coordinated publishing across multiple personas; this workflow manages planning + posting.",
    tags: ["instagram", "influencer", "scheduler", "fal"],
    file: "data/workflows/episodes/episode_35_influencer_machine.json",
  },
  {
    id: "seo-keyword-rank-tracker",
    title: "Keyword Rank Tracker (Sheets)",
    description:
      "Daily schedule that calls Serper, normalizes ranking data, and writes results plus deltas into Google Sheets dashboards.",
    problem:
      "SEO teams need rank tracking without paying for SaaS limits; this workflow tracks unlimited keywords per site.",
    tags: ["seo", "ranks", "google-sheets", "serper"],
    file: "data/workflows/episodes/marvo_keyword_rank_tracker.json",
  },
  {
    id: "seo-serp-analysis",
    title: "SERP & Competitor Analyzer",
    description:
      "Pulls SERP data from Serper, crawls top results via Crawl4AI, and builds structured competitor summaries for writers.",
    problem:
      "Content teams spend 30+ minutes per article doing manual SERP research; this template automates the entire brief.",
    tags: ["seo", "serp", "crawl", "briefs"],
    file: "data/workflows/episodes/marvo_serp_analysis.json",
  },
  {
    id: "gsc-ai-writer",
    title: "GSC AI SEO Writer",
    description:
      "Fetches page/query data from Google Search Console, feeds it into Gemini, and outputs rewrite suggestions plus new sections.",
    problem:
      "Optimizing underperforming articles requires juggling GSC data and AI prompts; this workflow packages insights automatically.",
    tags: ["seo", "gsc", "ai", "writer"],
    file: "data/workflows/episodes/marvo_gsc_ai_seo_writer.json",
  },
  {
    id: "ai-overview-audit",
    title: "AI Overview Analyzer",
    description:
      "Scrapes Google's AI Overviews for a keyword, extracts entities/sources, and generates a content blueprint to earn inclusion.",
    problem:
      "Brands want to appear inside AI Overview answers, but it's unclear what structure Google expects; this agent reverse engineers it.",
    tags: ["seo", "ai-overview", "analysis"],
    file: "data/workflows/episodes/marvo_ai_overview_analyzer.json",
  },
  {
    id: "gsc-api-toolkit",
    title: "Google Search Console API Toolkit",
    description:
      "Bundle of 12 prebuilt nodes/queries that pull query, page, device, and indexing metrics for advanced SEO analysis.",
    problem:
      "Analysts spend hours wiring up GSC for each use case; this template provides ready-made building blocks.",
    tags: ["gsc", "api", "analytics"],
    file: "data/workflows/episodes/marvo_gsc_api_examples.json",
  },
  {
    id: "json-report-generator",
    title: "JSON → HTML Report Generator",
    description:
      "Accepts arbitrary JSON payloads and renders a styled HTML report with sections, tables, and download links.",
    problem:
      "Teams need sharable reports from automation outputs; this template formats data for stakeholders automatically.",
    tags: ["reports", "html", "automation"],
    file: "data/workflows/episodes/marvo_report_generator.json",
  },
  {
    id: "notion-todoist-two-way-sync",
    title: "Realtime Notion ↔ Todoist Sync",
    description:
      "Complex two-way sync handling webhook events, batching, Redis dedupe, and SSE notifications between Notion and Todoist.",
    problem:
      "Teams maintaining parallel task systems need reliable bidirectional sync with conflict handling.",
    tags: ["notion", "todoist", "sync", "webhook", "redis"],
    file: "data/workflows/episodes/dan_1897_notion_todoist_sync.json",
  },
  {
    id: "youtube-playlist-summarizer",
    title: "AI YouTube Playlist Summaries",
    description:
      "Fetches playlists, downloads transcripts, caches data in Redis/Qdrant, and produces long-form summaries with Gemini.",
    problem:
      "Knowledge workers want digestible summaries of hours-long playlists without manual watching.",
    tags: ["youtube", "summaries", "redis", "qdrant", "gemini"],
    file: "data/workflows/episodes/dan_0971_youtube_summary.json",
  },
  {
    id: "notion-clockify-sync",
    title: "Notion → Clockify Sync",
    description:
      "Compares datasets, syncs tasks, and keeps Notion databases aligned with Clockify time tracking via webhooks.",
    problem:
      "Ops teams struggle to reconcile project plans with actual time entries across tools.",
    tags: ["notion", "clockify", "time-tracking", "webhook"],
    file: "data/workflows/episodes/dan_1498_notion_clockify.json",
  },
  {
    id: "bamboohr-webhook-sandbox",
    title: "Webhook Sandbox & BambooHR Alerts",
    description:
      "Uses PostBin + Cal.com forms to capture HR events, enriches data with OpenAI, and pushes alerts to Slack.",
    problem:
      "Testing webhook-driven HR flows is painful; this template lets you inspect payloads and automate BambooHR handling.",
    tags: ["bamboohr", "webhook", "slack", "cal.com"],
    file: "data/workflows/episodes/dan_1977_webhook_test.json",
  },
  {
    id: "social-publishing-factory",
    title: "Omni-Channel Social Publishing Factory",
    description:
      "Uploads assets, crafts prompts, and pushes content to Telegram, LinkedIn, Instagram, Facebook, and Twitter with approval flows.",
    problem:
      "Marketing teams need one automation to fan out content across every network while keeping humans in the loop.",
    tags: ["social", "telegram", "linkedin", "instagram", "facebook"],
    file: "data/workflows/episodes/dan_1342_social_factory.json",
  },
  {
    id: "shopify-to-d365",
    title: "Shopify → D365 Sales Doc Sync",
    description:
      "Transforms Shopify orders into D365 Business Central sales orders/invoices using SplitOut/Batch patterns and HTTP connectors.",
    problem:
      "Ecommerce ops struggle to mirror Shopify transactions inside ERP without manual re-entry.",
    tags: ["shopify", "d365", "ecommerce", "erp"],
    file: "data/workflows/episodes/dan_1560_shopify_d365.json",
  },
  {
    id: "whatsapp-erp-router",
    title: "WhatsApp ERP Support Router",
    description:
      "Ingests WhatsApp webhooks, enriches messages via Gemini, and routes cases into ERPNext + Outlook workflows.",
    problem:
      "Support teams need to convert customer WhatsApp threads into structured ERP tickets automatically.",
    tags: ["whatsapp", "erpnext", "support"],
    file: "data/workflows/episodes/dan_1274_whatsapp_router.json",
  },
  {
    id: "slack-incident-webhook",
    title: "Slack Incident Intake Hub",
    description:
      "Uses form triggers, Hive alerting, and Slack responses to capture incidents, enrich them, and push follow-ups.",
    problem:
      "Security teams need a consistent intake for incidents from forms/webhooks with Slack-based collaboration.",
    tags: ["slack", "incident", "forms", "security"],
    file: "data/workflows/episodes/dan_0644_slack_incident.json",
  },
  {
    id: "suspicious-login-watch",
    title: "Suspicious Login Detection",
    description:
      "Monitors Postgres auth events, applies custom HTML/email checks, and notifies Slack when thresholds are met.",
    problem:
      "Ops teams need early warning when risky logins occur across multiple properties.",
    tags: ["security", "postgres", "slack", "monitoring"],
    file: "data/workflows/episodes/dan_2014_suspicious_login.json",
  },
  {
    id: "woocommerce-shipping-dhl",
    title: "WooCommerce + DHL Fulfillment Console",
    description:
      "Captures WooCommerce orders via forms, calls DHL APIs, and drives execution workflows to fulfill shipments.",
    problem:
      "Store owners want automatic shipping label orchestration between WooCommerce and DHL without manual exports.",
    tags: ["woocommerce", "dhl", "shipping", "forms"],
    file: "data/workflows/episodes/dan_0457_woocommerce_shipping.json",
  },
  {
    id: "woocommerce-ai-chatbot",
    title: "WooCommerce Post-Sales AI Chatbot",
    description:
      "Combines Telegram bots, Cal.com, RAG over docs, and WooCommerce tools to answer order questions and create tickets.",
    problem:
      "Support teams need an AI assistant that understands WooCommerce orders and can provide follow-up steps automatically.",
    tags: ["woocommerce", "telegram", "support", "rag"],
    file: "data/workflows/episodes/dan_1575_woocommerce_ai_chatbot.json",
  },
  {
    id: "stripe-zoom-payments",
    title: "Stripe-Paid Zoom Booking",
    description:
      "Collects payments via Stripe Checkout, records attendees in Sheets, emails confirmations, and provisions Zoom sessions.",
    problem:
      "Consultants want to gate Zoom meetings behind payment without juggling multiple tools manually.",
    tags: ["stripe", "zoom", "payments", "forms"],
    file: "data/workflows/episodes/dan_0739_stripe_zoom.json",
  },
  {
    id: "stripe-quickbooks-sync",
    title: "Stripe → QuickBooks Invoice Sync",
    description:
      "Listens to Stripe events, looks up QuickBooks customers, and posts invoices/charges to accounting automatically.",
    problem:
      "Finance teams need Stripe transactions reflected in QuickBooks without exporting CSVs.",
    tags: ["stripe", "quickbooks", "accounting"],
    file: "data/workflows/episodes/dan_0707_stripe_quickbooks.json",
  },
  {
    id: "pipedrive-billing-handoff",
    title: "Pipedrive + Stripe Deal Billing",
    description:
      "Scheduled workflow that inspects Pipedrive deals, builds Stripe charges, and syncs results via Function & ItemList nodes.",
    problem:
      "Sales ops need closed deals to trigger billing automatically so finance isn’t chasing spreadsheets.",
    tags: ["pipedrive", "stripe", "sales-ops"],
    file: "data/workflows/episodes/dan_0246_pipedrive_billing.json",
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
