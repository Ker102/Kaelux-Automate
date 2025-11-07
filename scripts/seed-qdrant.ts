import "dotenv/config";

import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { Document } from "@langchain/core/documents";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { QdrantVectorStore } from "@langchain/community/vectorstores/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";

type SampleWorkflow = {
  id: string;
  title: string;
  description: string;
  problem: string;
  tags: string[];
  workflow: Record<string, unknown>;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SAMPLE_FILE = path.resolve(
  __dirname,
  "../data/workflows/sample-workflows.json"
);
const QDRANT_URL = process.env.QDRANT_URL ?? "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const QDRANT_COLLECTION =
  process.env.QDRANT_COLLECTION ?? "ai_workflow_examples";
const GEMINI_EMBED_MODEL =
  process.env.GEMINI_EMBED_MODEL ?? "text-embedding-004";

async function loadSampleWorkflows(filePath = DEFAULT_SAMPLE_FILE) {
  const file = await readFile(filePath, "utf-8");
  const payload = JSON.parse(file) as SampleWorkflow[];

  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error(`No workflows found in ${filePath}`);
  }

  return payload;
}

function buildDocument(sample: SampleWorkflow) {
  const nodeCount = Array.isArray(sample.workflow?.nodes)
    ? sample.workflow.nodes.length
    : 0;

  const content = [
    sample.title,
    "",
    sample.description,
    "",
    `Problem solved: ${sample.problem}`,
    "",
    `Tags: ${sample.tags.join(", ")}`,
    `Node count: ${nodeCount}`,
  ].join("\n");

  return new Document({
    pageContent: content,
    metadata: {
      id: sample.id,
      title: sample.title,
      tags: sample.tags,
      workflow: sample.workflow,
    },
  });
}

async function ensureCollection(client: QdrantClient, vectorSize: number) {
  try {
    await client.deleteCollection(QDRANT_COLLECTION);
    console.info(`Deleted existing collection "${QDRANT_COLLECTION}".`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("not found")) {
      console.warn(`Could not delete collection: ${message}`);
    }
  }

  await client.createCollection(QDRANT_COLLECTION, {
    vectors: {
      size: vectorSize,
      distance: "Cosine",
    },
  });

  console.info(
    `Created collection "${QDRANT_COLLECTION}" (dimension ${vectorSize}).`
  );
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env.local before seeding Qdrant."
    );
  }

  const samples = await loadSampleWorkflows();
  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: process.env.GEMINI_API_KEY,
    model: GEMINI_EMBED_MODEL,
  });

  // The size is model-dependent. text-embedding-004 returns 768 dims.
  const vectorSize = 768;
  const client = new QdrantClient({
    url: QDRANT_URL,
    apiKey: QDRANT_API_KEY,
  });

  await ensureCollection(client, vectorSize);

  const documents = samples.map(buildDocument);
  await QdrantVectorStore.fromDocuments(documents, embeddings, {
    client,
    collectionName: QDRANT_COLLECTION,
  });

  console.log(
    `Seeded ${documents.length} workflow example(s) into "${QDRANT_COLLECTION}".`
  );
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[seed-qdrant]", error);
    process.exit(1);
  });
