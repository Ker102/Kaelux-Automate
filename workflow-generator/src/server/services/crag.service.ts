/**
 * CRAG (Corrective RAG) Service
 * 
 * Full Pipeline:
 * 1. Retrieve many documents from Qdrant
 * 2. Rerank using Jina Reranker API
 * 3. Judge/validate with Mistral-Nemo (Together AI)
 * 4. Optionally rewrite query if documents are poor
 * 5. Return top relevant documents
 */

interface RerankedDocument {
    text: string;
    score: number;
    metadata: Record<string, unknown>;
}

interface JinaRerankResponse {
    results: Array<{
        index: number;
        relevance_score: number;
        document: { text: string };
    }>;
}

interface TogetherChatResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

interface JudgeResult {
    isRelevant: boolean;
    confidence: number;
    reasoning: string;
    suggestedRewrite?: string;
}

export class CRAGService {
    private jinaApiKey: string | undefined;
    private togetherApiKey: string | undefined;
    private jinaEndpoint = 'https://api.jina.ai/v1/rerank';
    private togetherEndpoint = 'https://api.together.xyz/v1/chat/completions';
    private judgeModel = 'mistralai/Mistral-Nemo-Instruct-2407';

    constructor() {
        this.jinaApiKey = process.env.JINA_API_KEY;
        this.togetherApiKey = process.env.TOGETHER_API_KEY;

        if (!this.jinaApiKey) {
            console.warn('⚠️ JINA_API_KEY not set - reranking will be disabled');
        }
        if (!this.togetherApiKey) {
            console.warn('⚠️ TOGETHER_API_KEY not set - judge will be disabled');
        }

        if (this.jinaApiKey && this.togetherApiKey) {
            console.log('✅ CRAG Service initialized with Jina Reranker + Mistral-Nemo Judge');
        } else if (this.jinaApiKey) {
            console.log('✅ CRAG Service initialized with Jina Reranker (no judge)');
        }
    }

    isAvailable(): boolean {
        return !!this.jinaApiKey;
    }

    isJudgeAvailable(): boolean {
        return !!this.togetherApiKey;
    }

    /**
     * Rerank documents using Jina Reranker API
     */
    async rerank(
        query: string,
        documents: Array<{ text: string; metadata: Record<string, unknown> }>,
        topK: number = 5
    ): Promise<RerankedDocument[]> {
        if (!this.jinaApiKey) {
            console.log('⚠️ Reranker not available, returning original order');
            return documents.slice(0, topK).map((doc, i) => ({
                text: doc.text,
                score: 1 - (i * 0.1),
                metadata: doc.metadata,
            }));
        }

        if (documents.length === 0) {
            return [];
        }

        console.log(`🔄 Reranking ${documents.length} documents with Jina...`);

        try {
            const response = await fetch(this.jinaEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.jinaApiKey}`,
                },
                body: JSON.stringify({
                    model: 'jina-reranker-v2-base-multilingual',
                    query: query,
                    documents: documents.map(d => d.text),
                    top_n: topK,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('Jina rerank error:', error);
                throw new Error(`Jina API error: ${response.status}`);
            }

            const data: JinaRerankResponse = await response.json();

            const reranked: RerankedDocument[] = data.results.map(result => ({
                text: documents[result.index].text,
                score: result.relevance_score,
                metadata: documents[result.index].metadata,
            }));

            console.log(`✅ Reranked to top ${reranked.length} documents`);
            console.log(`   Top scores: ${reranked.slice(0, 3).map(r => r.score.toFixed(3)).join(', ')}`);

            return reranked;
        } catch (error) {
            console.error('Reranking failed:', error);
            return documents.slice(0, topK).map((doc, i) => ({
                text: doc.text,
                score: 1 - (i * 0.1),
                metadata: doc.metadata,
            }));
        }
    }

    /**
     * Judge documents using Mistral-Nemo via Together AI
     * Returns whether documents are relevant and suggests query rewrite if not
     */
    async judge(
        query: string,
        documents: RerankedDocument[]
    ): Promise<JudgeResult> {
        if (!this.togetherApiKey || documents.length === 0) {
            return {
                isRelevant: true,
                confidence: 0.5,
                reasoning: 'Judge not available, assuming documents are relevant',
            };
        }

        console.log(`⚖️ Judging ${documents.length} documents with Mistral-Nemo...`);

        const docSummary = documents.slice(0, 5).map((d, i) =>
            `[${i + 1}] (score: ${d.score.toFixed(2)}) ${d.text.substring(0, 200)}...`
        ).join('\n');

        const systemPrompt = `You are a relevance judge for a RAG system. Your job is to determine if the retrieved documents are relevant to the user's query about n8n workflow automation.

Respond in JSON format:
{
  "isRelevant": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "suggestedRewrite": "optional: better query if documents are not relevant"
}`;

        const userPrompt = `Query: "${query}"

Retrieved Documents:
${docSummary}

Are these documents relevant to the query? If not, suggest a better query.`;

        try {
            const response = await fetch(this.togetherEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.togetherApiKey}`,
                },
                body: JSON.stringify({
                    model: this.judgeModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt },
                    ],
                    temperature: 0.1,
                    max_tokens: 300,
                }),
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('Together judge error:', error);
                throw new Error(`Together API error: ${response.status}`);
            }

            const data: TogetherChatResponse = await response.json();
            const content = data.choices[0]?.message?.content || '';

            // Parse JSON response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]) as JudgeResult;
                console.log(`⚖️ Judge verdict: ${result.isRelevant ? '✅ Relevant' : '❌ Not relevant'} (${(result.confidence * 100).toFixed(0)}% confidence)`);
                if (result.suggestedRewrite) {
                    console.log(`   Suggested rewrite: "${result.suggestedRewrite}"`);
                }
                return result;
            }

            return {
                isRelevant: true,
                confidence: 0.5,
                reasoning: 'Could not parse judge response',
            };
        } catch (error) {
            console.error('Judge failed:', error);
            return {
                isRelevant: true,
                confidence: 0.5,
                reasoning: `Judge error: ${error}`,
            };
        }
    }

    /**
     * Full CRAG pipeline: Retrieve → Rerank → Judge → (Optional: Rewrite Loop)
     */
    async process(
        query: string,
        documents: Array<{ text: string; metadata: Record<string, unknown> }>,
        options: {
            topK?: number;
            scoreThreshold?: number;
            enableJudge?: boolean;
            maxRetries?: number;
        } = {}
    ): Promise<{
        documents: RerankedDocument[];
        wasReranked: boolean;
        wasJudged: boolean;
        queryRewritten: boolean;
        finalQuery: string;
    }> {
        const { topK = 5, scoreThreshold = 0.3, enableJudge = true, maxRetries = 1 } = options;
        let currentQuery = query;
        let queryRewritten = false;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            // Step 1: Rerank
            const reranked = await this.rerank(currentQuery, documents, topK * 2);

            // Step 2: Filter by score threshold
            const filtered = reranked.filter(doc => doc.score >= scoreThreshold);

            console.log(`📊 CRAG: ${documents.length} → ${reranked.length} reranked → ${filtered.length} above threshold`);

            // Step 3: Judge (if enabled and available)
            if (enableJudge && this.isJudgeAvailable() && attempt < maxRetries) {
                const judgeResult = await this.judge(currentQuery, filtered);

                if (!judgeResult.isRelevant && judgeResult.suggestedRewrite) {
                    console.log(`🔄 Query rewrite attempt ${attempt + 1}: "${judgeResult.suggestedRewrite}"`);
                    currentQuery = judgeResult.suggestedRewrite;
                    queryRewritten = true;
                    continue; // Retry with new query
                }
            }

            return {
                documents: filtered.slice(0, topK),
                wasReranked: this.isAvailable(),
                wasJudged: enableJudge && this.isJudgeAvailable(),
                queryRewritten,
                finalQuery: currentQuery,
            };
        }

        // Fallback if all retries exhausted
        return {
            documents: [],
            wasReranked: this.isAvailable(),
            wasJudged: enableJudge && this.isJudgeAvailable(),
            queryRewritten,
            finalQuery: currentQuery,
        };
    }

    /**
     * Format reranked documents for LLM context
     */
    formatForContext(documents: RerankedDocument[]): string {
        if (documents.length === 0) {
            return '';
        }

        const formatted = documents.map((doc) => {
            const score = doc.score.toFixed(2);
            return `[Relevance: ${score}]\n${doc.text}`;
        }).join('\n\n---\n\n');

        return `RELEVANT CONTEXT (reranked by relevance):\n\n${formatted}`;
    }
}

// Singleton
let cragInstance: CRAGService | null = null;
export function getCRAGService(): CRAGService {
    if (!cragInstance) {
        cragInstance = new CRAGService();
    }
    return cragInstance;
}
