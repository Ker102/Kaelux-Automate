import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import type { Workflow } from '@shared/types.js';

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
 */
export class RAGService {
    private client: QdrantClient | null = null;
    private embeddings: GoogleGenerativeAIEmbeddings | null = null;
    private workflowCollection: string;
    private nodesCollection = 'n8n_nodes';

    constructor() {
        const url = process.env.QDRANT_URL;
        const apiKey = process.env.QDRANT_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;

        if (!url || !apiKey) {
            console.warn('⚠️ Qdrant credentials not configured, RAG disabled');
            return;
        }

        this.client = new QdrantClient({ url, apiKey });
        this.workflowCollection = process.env.QDRANT_COLLECTION || 'n8n_workflows';

        if (geminiKey) {
            this.embeddings = new GoogleGenerativeAIEmbeddings({
                apiKey: geminiKey,
                model: 'text-embedding-004',
            });
        }
    }

    isAvailable(): boolean {
        return this.client !== null && this.embeddings !== null;
    }

    /**
     * Search for relevant nodes based on prompt
     */
    async searchRelevantNodes(prompt: string, limit: number = 10): Promise<NodeInfo[]> {
        if (!this.isAvailable()) return [];

        try {
            const vector = await this.embeddings!.embedQuery(prompt);
            const results = await this.client!.search(this.nodesCollection, {
                vector,
                limit,
                with_payload: true,
            });

            console.log(`🧩 Found ${results.length} relevant nodes for prompt`);

            return results.map(r => ({
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
     * Search for similar workflows
     */
    async searchSimilarWorkflows(prompt: string, limit: number = 3): Promise<Array<{
        workflow: Workflow;
        score: number;
        name: string;
    }>> {
        if (!this.isAvailable()) return [];

        try {
            const vector = await this.embeddings!.embedQuery(prompt);
            const results = await this.client!.search(this.workflowCollection, {
                vector,
                limit,
                with_payload: true,
            });

            console.log(`📋 Found ${results.length} similar workflows`);

            return results.map(result => ({
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
     */
    async getContextForPrompt(prompt: string, maxNodes: number = 10, maxWorkflows: number = 2): Promise<string> {
        // Get relevant nodes
        const nodes = await this.searchRelevantNodes(prompt, maxNodes);
        const nodeContext = nodes.length > 0
            ? `RELEVANT NODES FOR THIS TASK:\n${nodes.map(n =>
                `• ${n.displayName} (${n.type}): ${n.description}${n.resources.length > 0 ? ` | Operations: ${n.resources.join(', ')}` : ''}`
            ).join('\n')}`
            : '';

        // Get similar workflow examples
        const workflows = await this.searchSimilarWorkflows(prompt, maxWorkflows);
        const workflowContext = workflows.length > 0
            ? `\nSIMILAR WORKFLOW EXAMPLES:\n${workflows.map((w, i) => {
                const nodeTypes = w.workflow.nodes?.map(n => n.type.replace('n8n-nodes-base.', '')).join(' → ') || 'unknown';
                return `${i + 1}. "${w.name}" (score: ${w.score.toFixed(2)}): ${nodeTypes}`;
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
