#!/usr/bin/env node
/**
 * Ingest n8n node metadata into Qdrant for RAG retrieval
 * Creates embeddings for node descriptions and ingests into 'n8n_nodes' collection
 * 
 * Run: node scripts/ingest-nodes-to-qdrant.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load env
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const REGISTRY_FILE = path.join(__dirname, '../src/server/data/nodes-full-registry.json');
const COLLECTION_NAME = 'n8n_nodes';
const EMBEDDING_DIM = 768;  // Gemini text-embedding-004 dimension

async function main() {
    console.log('📦 Ingesting n8n nodes into Qdrant...');

    // Check env vars
    const qdrantUrl = process.env.QDRANT_URL;
    const qdrantKey = process.env.QDRANT_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!qdrantUrl || !qdrantKey) {
        console.error('❌ Missing QDRANT_URL or QDRANT_API_KEY');
        process.exit(1);
    }
    if (!geminiKey) {
        console.error('❌ Missing GEMINI_API_KEY for embeddings');
        process.exit(1);
    }

    // Load registry
    if (!fs.existsSync(REGISTRY_FILE)) {
        console.error(`❌ Registry not found: ${REGISTRY_FILE}`);
        console.log('Run extract-full-node-metadata.mjs first');
        process.exit(1);
    }

    const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
    console.log(`📋 Loaded ${registry.nodes.length} nodes`);

    // Init clients
    const qdrant = new QdrantClient({ url: qdrantUrl, apiKey: qdrantKey });
    const genAI = new GoogleGenerativeAI(geminiKey);
    const embedModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    // Create/recreate collection
    try {
        await qdrant.deleteCollection(COLLECTION_NAME);
        console.log('🗑️ Deleted existing collection');
    } catch { }

    await qdrant.createCollection(COLLECTION_NAME, {
        vectors: {
            size: EMBEDDING_DIM,
            distance: 'Cosine',
        }
    });
    console.log(`✅ Created collection: ${COLLECTION_NAME}`);

    // Process nodes in batches
    const BATCH_SIZE = 20;
    let processed = 0;

    for (let i = 0; i < registry.nodes.length; i += BATCH_SIZE) {
        const batch = registry.nodes.slice(i, i + BATCH_SIZE);

        // Generate embeddings for this batch
        const embeddings = await Promise.all(batch.map(async (node) => {
            // Create a rich text representation for embedding
            const text = [
                node.displayName,
                node.description,
                `Categories: ${node.categories.join(', ')}`,
                node.aliases.length > 0 ? `Also known as: ${node.aliases.join(', ')}` : '',
                node.resources.length > 0 ? `Operations: ${node.resources.join(', ')}` : '',
            ].filter(Boolean).join('. ');

            const result = await embedModel.embedContent(text);
            return result.embedding.values;
        }));

        // Prepare points for Qdrant
        const points = batch.map((node, idx) => ({
            id: processed + idx + 1,  // Qdrant IDs start at 1
            vector: embeddings[idx],
            payload: {
                type: node.type,
                displayName: node.displayName,
                description: node.description,
                categories: node.categories,
                aliases: node.aliases,
                resources: node.resources,
                documentationUrl: node.documentationUrl,
            }
        }));

        // Upsert to Qdrant
        await qdrant.upsert(COLLECTION_NAME, {
            wait: true,
            points,
        });

        processed += batch.length;
        console.log(`   📤 Ingested ${processed}/${registry.nodes.length} nodes`);

        // Rate limit
        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n✅ Successfully ingested ${processed} nodes into Qdrant`);
    console.log(`📊 Collection: ${COLLECTION_NAME}`);

    // Test query
    console.log('\n🔍 Testing search for "send message"...');
    const testVector = (await embedModel.embedContent('send message to slack')).embedding.values;
    const results = await qdrant.search(COLLECTION_NAME, {
        vector: testVector,
        limit: 5,
        with_payload: true,
    });

    console.log('Top results:');
    results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.payload.displayName} (score: ${r.score.toFixed(3)})`);
    });
}

main().catch(console.error);
