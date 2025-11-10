import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/community/vectorstores/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-pro";
const GEMINI_FALLBACK_MODEL =
  process.env.GEMINI_FALLBACK_MODEL ?? "gemini-2.5-flash";
const GEMINI_EMBED_MODEL =
  process.env.GEMINI_EMBED_MODEL ?? "text-embedding-004";
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const QDRANT_COLLECTION =
  process.env.QDRANT_COLLECTION ?? "ai_workflow_examples";

if (!GEMINI_API_KEY) {
  console.warn(
    "[AI] Missing GEMINI_API_KEY. Add it to your environment to enable the AI workflow endpoint."
  );
}

const genAI = GEMINI_API_KEY
  ? new GoogleGenerativeAI(GEMINI_API_KEY)
  : undefined;
const embeddings =
  GEMINI_API_KEY && GEMINI_EMBED_MODEL
    ? new GoogleGenerativeAIEmbeddings({
        apiKey: GEMINI_API_KEY,
        model: GEMINI_EMBED_MODEL,
      })
    : undefined;

let vectorStorePromise: Promise<QdrantVectorStore | null> | null = null;

const systemInstruction = `
You are an n8n Workflow Architect. Your job is to design production-ready workflows for automation engineers.

Context you receive:
- The user's free-form request.
- A set of retrieved workflow examples. Each example includes metadata (industries, domains, channels, trigger, complexity, integrations) plus representative JSON.

Behavioural rules:
1. First understand the user's objective, required data sources, and delivery channels.
2. Use the metadata from retrieved examples to align with the user's domain (e.g., if request mentions finance, prefer workflows with finance integrations). Cite relevant example titles in the notes section.
3. Design a plan that specifies trigger(s), core nodes, data transformations, branching, and external services.
4. Produce well-structured n8n JSON:
   - Use descriptive node names (no placeholders like "Node 1").
   - Include only available credentials as placeholders (e.g., "{{STRIPE_API_KEY}}").
   - Ensure connections represent a coherent execution path.
5. Keep the summary short (2-3 sentences) describing what the workflow achieves.
6. Populate notes with:
   - Required credentials or manual setup.
   - Optional enhancements or monitoring tips.
   - References to retrieved examples you drew inspiration from (e.g., "Inspired by Shopify → D365 Sales Doc Sync").
7. If information is missing, make reasonable assumptions and mention them in notes.
8. Never wrap the response in markdown fences; respond strictly with JSON matching:
{
  "summary": string,
  "workflow": object,
  "notes": string[],
  "rawText": string
}
`;

export type AiWorkflowSuggestion = {
  summary: string;
  workflow: unknown;
  notes?: string[];
  rawText: string;
};

type RetrievedWorkflow = {
  title?: string;
  summary?: string;
  tags?: string[];
  metadata?: {
    industries?: string[];
    domains?: string[];
    channels?: string[];
    trigger?: string;
    complexity?: string;
    integrations?: string[];
  };
  workflow?: {
    name?: string;
    nodes?: unknown;
    connections?: unknown;
  };
};

async function getVectorStore(): Promise<QdrantVectorStore | null> {
  if (!embeddings) {
    return null;
  }

  if (!vectorStorePromise) {
    vectorStorePromise = (async () => {
      try {
        const client = new QdrantClient({
          url: QDRANT_URL,
          apiKey: QDRANT_API_KEY,
        });
        const store = await QdrantVectorStore.fromExistingCollection(
          embeddings,
          {
            client,
            collectionName: QDRANT_COLLECTION,
          }
        );
        return store;
      } catch (error) {
        console.warn("[AI] Unable to initialize Qdrant vector store:", error);
        return null;
      }
    })();
  }

  return vectorStorePromise;
}

async function fetchWorkflowExamples(
  query: string,
  topK = 3
): Promise<RetrievedWorkflow[]> {
  try {
    const store = await getVectorStore();
    if (!store) {
      return [];
    }

    const inferred = inferMetadataFromPrompt(query);
    const rawDocs = await store.similaritySearch(query, Math.max(topK * 3, topK));
    const scored = rawDocs.map((doc, index) => {
      const example: RetrievedWorkflow = {
        title: (doc.metadata?.title as string) ?? "Untitled workflow",
        summary: doc.pageContent,
        tags: (doc.metadata?.tags as string[]) ?? [],
        metadata: doc.metadata?.metadata as RetrievedWorkflow["metadata"],
        workflow: doc.metadata?.workflow as RetrievedWorkflow["workflow"],
      };
      const metadataScore = scoreMetadataMatch(example, inferred);
      return { example, metadataScore, originalIndex: index };
    });

    return scored
      .sort((a, b) => {
        if (b.metadataScore === a.metadataScore) {
          return a.originalIndex - b.originalIndex;
        }
        return b.metadataScore - a.metadataScore;
      })
      .slice(0, topK)
      .map((entry) => entry.example);
  } catch (error) {
    console.warn("[AI] Similarity search failed:", error);
    return [];
  }
}

function buildFewShotContext(examples: RetrievedWorkflow[]): string {
  if (examples.length === 0) {
    return "";
  }

  return examples
    .map((example, index) => {
      const workflowSnippet =
        example.workflow && (example.workflow.nodes || example.workflow.connections)
          ? JSON.stringify(
              {
                name: example.workflow.name,
                nodes: example.workflow.nodes,
                connections: example.workflow.connections,
              },
              null,
              2
            )
          : "Workflow JSON unavailable.";

      const tags =
        example.tags && example.tags.length > 0
          ? `Tags: ${example.tags.join(", ")}`
          : "";
      const metadataText = example.metadata
        ? `Industries: ${example.metadata.industries?.join(", ") ?? "n/a"} | Domains: ${
            example.metadata.domains?.join(", ") ?? "n/a"
          } | Channels: ${example.metadata.channels?.join(", ") ?? "n/a"} | Trigger: ${
            example.metadata.trigger ?? "n/a"
          } | Complexity: ${example.metadata.complexity ?? "n/a"} | Integrations: ${
            example.metadata.integrations?.join(", ") ?? "n/a"
          }`
        : "Metadata: n/a";

      return `Example ${index + 1}: ${example.title}
${tags}
${metadataText}
Summary: ${example.summary ?? "n/a"}
Workflow:
${workflowSnippet}`;
    })
    .join("\n\n");
}

type InferredMetadata = {
  industries: Set<string>;
  domains: Set<string>;
  channels: Set<string>;
  trigger?: string;
};

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  ecommerce: ["shopify", "woocommerce", "stripe", "checkout", "cart", "order", "product"],
  marketing: ["linkedin", "instagram", "tiktok", "facebook", "campaign", "content", "post", "social"],
  finance: ["invoice", "billing", "quickbooks", "expense", "payroll", "accounting", "paypal", "finance"],
  support: ["zendesk", "support", "ticket", "helpdesk", "customer success"],
  hr: ["bamboohr", "resume", "interview", "ats", "candidate", "hiring"],
  analytics: ["analytics", "serp", "seo", "search console", "rank", "report"],
  media: ["youtube", "music", "video", "podcast", "shorts"],
};

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  "two-way-sync": ["sync", "two-way", "bi-directional"],
  "incident-response": ["incident", "alert", "security", "monitoring"],
  "content-scheduling": ["schedule", "calendar", "queue", "publishing"],
  "summaries": ["summarize", "digest", "recap"],
  "payments": ["payment", "checkout", "paid", "subscription"],
  "ticket-routing": ["support", "ticket", "assign"],
  "video-generation": ["video", "render", "footage"],
  "reporting": ["report", "dashboard", "insights"],
};

const CHANNEL_KEYWORDS: Record<string, string[]> = {
  slack: ["slack"],
  telegram: ["telegram"],
  whatsapp: ["whatsapp"],
  email: ["email", "gmail", "outlook"],
  zoom: ["zoom"],
  notion: ["notion"],
  quickbooks: ["quickbooks"],
  sheets: ["google sheets", "sheet"],
};

const TRIGGER_KEYWORDS: Record<string, string[]> = {
  webhook: ["webhook", "http", "api callback", "incoming"],
  scheduled: ["daily", "weekly", "cron", "every day", "nightly"],
  manual: ["manually", "on demand", "when i click"],
};

function inferMetadataFromPrompt(prompt: string): InferredMetadata {
  const normalized = prompt.toLowerCase();
  const industries = new Set<string>();
  const domains = new Set<string>();
  const channels = new Set<string>();
  let trigger: string | undefined;

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      industries.add(industry);
    }
  }

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      domains.add(domain);
    }
  }

  for (const [channel, keywords] of Object.entries(CHANNEL_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      channels.add(channel);
    }
  }

  for (const [triggerType, keywords] of Object.entries(TRIGGER_KEYWORDS)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      trigger = triggerType;
      break;
    }
  }

  return { industries, domains, channels, trigger };
}

function scoreMetadataMatch(
  example: RetrievedWorkflow,
  inferred: InferredMetadata
): number {
  if (!example.metadata) {
    return 0;
  }

  let score = 0;
  const { industries = [], domains = [], channels = [], trigger } = example.metadata;

  industries.forEach((industry) => {
    if (inferred.industries.has(industry.toLowerCase())) {
      score += 3;
    }
  });

  domains.forEach((domain) => {
    if (inferred.domains.has(domain.toLowerCase())) {
      score += 2;
    }
  });

  channels.forEach((channel) => {
    if (inferred.channels.has(channel.toLowerCase())) {
      score += 1.5;
    }
  });

  if (trigger && inferred.trigger && trigger.toLowerCase() === inferred.trigger) {
    score += 1;
  }

  return score;
}

export async function generateWorkflowSuggestion(
  prompt: string
): Promise<AiWorkflowSuggestion> {
  if (!genAI) {
    throw new Error(
      "Gemini is not configured. Add GEMINI_API_KEY to enable this feature."
    );
  }

  const examples = await fetchWorkflowExamples(prompt);
  const fewShotContext = buildFewShotContext(examples);

  const userParts = [];
  if (fewShotContext) {
    userParts.push({
      text: `Reference workflows:\n${fewShotContext}\n\nUse them to inspire structure, node choices, and naming.`,
    });
  }
  userParts.push({
    text: `User request:\n${prompt}`,
  });

  async function invokeModel(modelName: string) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
    });
    const payload = userParts.map((part) => part.text).join("\n\n");
    try {
      const generation = await model.generateContent(payload);
      const raw = generation.response.text().trim();
      console.debug(`[AI] raw response from ${modelName}:`, raw);
      return raw;
    } catch (error) {
      console.error(`[AI] Gemini call failed for ${modelName}`, {
        message: error instanceof Error ? error.message : error,
        cause: (error as { cause?: unknown })?.cause,
      });
      throw error;
    }
  }

  let rawText: string;
  try {
    rawText = await invokeModel(GEMINI_MODEL);
  } catch (primaryError) {
    if (
      GEMINI_FALLBACK_MODEL &&
      GEMINI_FALLBACK_MODEL !== GEMINI_MODEL
    ) {
      console.warn(
        `[AI] Primary model ${GEMINI_MODEL} failed, falling back to ${GEMINI_FALLBACK_MODEL}`
      );
      rawText = await invokeModel(GEMINI_FALLBACK_MODEL);
    } else {
      throw primaryError;
    }
  }

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
