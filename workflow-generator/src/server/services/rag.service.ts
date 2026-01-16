import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import type { Workflow } from '@shared/types.js';
import { getCRAGService, type CRAGService } from './crag.service.js';

interface NodeInfo {
    type: string;
    displayName: string;
    description: string;
    categories: string[];
    aliases: string[];
    resources: string[];
    documentationUrl?: string;
}

/**
 * RAG Service for retrieving similar workflows AND relevant nodes from Qdrant Cloud
 * Now with CRAG (Corrective RAG) pipeline using Jina Reranker
 */
export class RAGService {
    private client: QdrantClient | null = null;
    private embeddings: GoogleGenerativeAIEmbeddings | null = null;
    private crag: CRAGService;
    private workflowCollection: string;
    private nodesCollection = 'n8n_nodes';

    constructor() {
        const url = process.env.QDRANT_URL;
        const apiKey = process.env.QDRANT_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;

        if (!url || !apiKey) {
            console.warn('⚠️ Qdrant credentials not configured, RAG disabled');
        } else {
            this.client = new QdrantClient({ url, apiKey });
            this.workflowCollection = process.env.QDRANT_COLLECTION || 'n8n_workflows';
        }

        if (geminiKey) {
            this.embeddings = new GoogleGenerativeAIEmbeddings({
                apiKey: geminiKey,
                model: 'text-embedding-004',
            });
        }

        // Initialize CRAG service for reranking
        this.crag = getCRAGService();
    }

    isAvailable(): boolean {
        return this.client !== null && this.embeddings !== null;
    }

    /**
     * Search for relevant nodes based on prompt (with optional CRAG reranking)
     */
    async searchRelevantNodes(prompt: string, limit: number = 10, useReranking: boolean = true): Promise<NodeInfo[]> {
        if (!this.isAvailable()) return [];

        try {
            const vector = await this.embeddings!.embedQuery(prompt);

            // Fetch more results if reranking
            const fetchLimit = useReranking && this.crag.isAvailable() ? limit * 3 : limit;

            const results = await this.client!.search(this.nodesCollection, {
                vector,
                limit: fetchLimit,
                with_payload: true,
            });

            console.log(`🧩 Retrieved ${results.length} nodes from Qdrant`);

            // Convert to documents for reranking
            const documents = results.map(r => ({
                text: `${r.payload?.displayName}: ${r.payload?.description}`,
                metadata: {
                    type: r.payload?.type,
                    displayName: r.payload?.displayName,
                    description: r.payload?.description,
                    categories: r.payload?.categories,
                    aliases: r.payload?.aliases,
                    resources: r.payload?.resources,
                    documentationUrl: r.payload?.documentationUrl,
                    score: r.score,
                } as Record<string, unknown>,
            }));

            // Apply CRAG reranking if available
            if (useReranking && this.crag.isAvailable()) {
                const { documents: reranked } = await this.crag.process(prompt, documents, {
                    topK: limit,
                    scoreThreshold: 0.2,
                });

                return reranked.map(doc => ({
                    type: doc.metadata.type as string || '',
                    displayName: doc.metadata.displayName as string || '',
                    description: doc.metadata.description as string || '',
                    categories: (doc.metadata.categories as string[]) || [],
                    aliases: (doc.metadata.aliases as string[]) || [],
                    resources: (doc.metadata.resources as string[]) || [],
                    documentationUrl: doc.metadata.documentationUrl as string,
                }));
            }

            // No reranking - return original order
            return results.slice(0, limit).map(r => ({
                type: r.payload?.type as string || '',
                displayName: r.payload?.displayName as string || '',
                description: r.payload?.description as string || '',
                categories: (r.payload?.categories as string[]) || [],
                aliases: (r.payload?.aliases as string[]) || [],
                resources: (r.payload?.resources as string[]) || [],
                documentationUrl: r.payload?.documentationUrl as string,
            }));
        } catch (error) {
            console.error('Node search error:', error);
            return [];
        }
    }

    /**
     * Search for similar workflows (with optional CRAG reranking)
     */
    async searchSimilarWorkflows(prompt: string, limit: number = 3, useReranking: boolean = true): Promise<Array<{
        workflow: Workflow;
        score: number;
        name: string;
    }>> {
        if (!this.isAvailable()) return [];

        try {
            const vector = await this.embeddings!.embedQuery(prompt);

            // Fetch more results if reranking
            const fetchLimit = useReranking && this.crag.isAvailable() ? limit * 4 : limit;

            const results = await this.client!.search(this.workflowCollection, {
                vector,
                limit: fetchLimit,
                with_payload: true,
            });

            console.log(`📋 Retrieved ${results.length} workflows from Qdrant`);

            // Convert to documents for reranking
            const documents = results.map(r => {
                const workflow = r.payload?.workflow as Workflow;
                const nodeTypes = workflow?.nodes?.map(n => n.type.replace('n8n-nodes-base.', '')).join(', ') || '';
                return {
                    text: `${r.payload?.name}: ${r.payload?.description || ''} Nodes: ${nodeTypes}`,
                    metadata: {
                        workflow,
                        name: r.payload?.name,
                        score: r.score,
                    } as Record<string, unknown>,
                };
            });

            // Apply CRAG reranking if available
            if (useReranking && this.crag.isAvailable()) {
                const { documents: reranked } = await this.crag.process(prompt, documents, {
                    topK: limit,
                    scoreThreshold: 0.3,
                });

                return reranked.map(doc => ({
                    workflow: doc.metadata.workflow as Workflow || { nodes: [], connections: {} },
                    score: doc.score,
                    name: (doc.metadata.name as string) || 'Unknown Workflow',
                }));
            }

            // No reranking - return original order
            return results.slice(0, limit).map(result => ({
                workflow: result.payload?.workflow as Workflow || { nodes: [], connections: {} },
                score: result.score,
                name: (result.payload?.name as string) || 'Unknown Workflow',
            }));
        } catch (error) {
            console.error('Workflow search error:', error);
            return [];
        }
    }

    /**
     * Get combined context: relevant nodes + similar workflows
     * Uses CRAG pipeline for better relevance
     */
    async getContextForPrompt(prompt: string, maxNodes: number = 10, maxWorkflows: number = 2): Promise<string> {
        // Get relevant nodes (with reranking)
        const nodes = await this.searchRelevantNodes(prompt, maxNodes, true);
        const nodeContext = nodes.length > 0
            ? `RELEVANT NODES FOR THIS TASK (reranked):\n${nodes.map(n =>
                `• ${n.displayName} (${n.type}): ${n.description}${n.resources.length > 0 ? ` | Operations: ${n.resources.join(', ')}` : ''}`
            ).join('\n')}`
            : '';

        // Get similar workflow examples (with reranking)
        const workflows = await this.searchSimilarWorkflows(prompt, maxWorkflows, true);
        const workflowContext = workflows.length > 0
            ? `\nSIMILAR WORKFLOW EXAMPLES (reranked):\n${workflows.map((w, i) => {
                const nodeTypes = w.workflow.nodes?.map(n => n.type.replace('n8n-nodes-base.', '')).join(' → ') || 'unknown';
                return `${i + 1}. "${w.name}" (relevance: ${w.score.toFixed(2)}): ${nodeTypes}`;
            }).join('\n')}`
            : '';

        if (!nodeContext && !workflowContext) return '';

        return `
${nodeContext}
${workflowContext}
---
`;
    }
}

// Singleton
let ragServiceInstance: RAGService | null = null;
export function getRAGService(): RAGService {
    if (!ragServiceInstance) {
        ragServiceInstance = new RAGService();
    }
    return ragServiceInstance;
}

