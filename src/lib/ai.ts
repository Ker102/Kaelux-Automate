import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/community/vectorstores/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-pro";
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

type RetrievedWorkflow = {
  title?: string;
  summary?: string;
  tags?: string[];
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

    const docs = await store.similaritySearch(query, topK);
    return docs.map((doc) => ({
      title: (doc.metadata?.title as string) ?? "Untitled workflow",
      summary: doc.pageContent,
      tags: (doc.metadata?.tags as string[]) ?? [],
      workflow: doc.metadata?.workflow as RetrievedWorkflow["workflow"],
    }));
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

      return `Example ${index + 1}: ${example.title}
${tags}
Summary: ${example.summary ?? "n/a"}
Workflow:
${workflowSnippet}`;
    })
    .join("\n\n");
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

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
  });

  const userParts = [];
  if (fewShotContext) {
    userParts.push({
      text: `Reference workflows:\n${fewShotContext}\n\nUse them to inspire structure, node choices, and naming.`,
    });
  }
  userParts.push({
    text: `User request:\n${prompt}`,
  });

  const generation = await model.generateContent([
    {
      role: "user",
      parts: userParts,
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
