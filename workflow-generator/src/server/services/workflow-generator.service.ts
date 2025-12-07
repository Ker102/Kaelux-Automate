import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import type { Workflow, GenerateResponse } from '@shared/types.js';

/**
 * Lightweight Workflow Generator Service
 * Uses Gemini to generate n8n workflows from natural language prompts
 */
export class WorkflowGeneratorService {
    private getModel(modelMode: 'fast' | 'thinking' | 'thinking-pro') {
        const apiKey = process.env.GEMINI_API_KEY || process.env.N8N_AI_GEMINI_KEY;

        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is required');
        }

        let modelName = 'gemini-2.0-flash';
        if (modelMode === 'thinking') modelName = 'gemini-2.5-pro';
        if (modelMode === 'thinking-pro') modelName = 'gemini-3.0-pro';

        return new ChatGoogleGenerativeAI({
            apiKey,
            model: modelName,
            temperature: 0.7,
        });
    }

    private getSystemPrompt(): string {
        return `You are an expert n8n workflow builder. Your task is to generate valid n8n workflow JSON based on user prompts.

IMPORTANT RULES:
1. Always output valid JSON that can be imported into n8n
2. Use only well-known n8n node types
3. Position nodes logically on the canvas
4. Include proper connections between nodes
5. Use descriptive node names

OUTPUT FORMAT:
Return a JSON object with this structure:
{
  "name": "Workflow Name",
  "nodes": [
    {
      "id": "unique-uuid",
      "name": "Node Display Name",
      "type": "n8n-nodes-base.nodeType",
      "typeVersion": 1,
      "position": [x, y],
      "parameters": {}
    }
  ],
  "connections": {
    "Source Node Name": {
      "main": [[{ "node": "Target Node Name", "type": "main", "index": 0 }]]
    }
  }
}

COMMON NODE TYPES:
- n8n-nodes-base.manualTrigger (start workflows manually)
- n8n-nodes-base.scheduleTrigger (cron-based triggers)
- n8n-nodes-base.httpRequest (API calls)
- n8n-nodes-base.set (set/transform data)
- n8n-nodes-base.if (conditional logic)
- n8n-nodes-base.splitInBatches (process items in batches)
- n8n-nodes-base.merge (combine data streams)
- n8n-nodes-base.code (custom JavaScript)
- n8n-nodes-base.gmail (send emails via Gmail)
- n8n-nodes-base.slack (send Slack messages)
- n8n-nodes-base.notion (Notion operations)
- n8n-nodes-base.googleSheets (Google Sheets operations)

POSITIONING:
- Start trigger nodes at x=250
- Space nodes 200 pixels apart horizontally
- Center vertically around y=300`;
    }

    async generate(
        prompt: string,
        modelMode: 'fast' | 'thinking' | 'thinking-pro' = 'fast'
    ): Promise<GenerateResponse> {
        const model = this.getModel(modelMode);

        const messages = [
            { role: 'system' as const, content: this.getSystemPrompt() },
            { role: 'user' as const, content: `Generate an n8n workflow for: ${prompt}` },
        ];

        console.log(`🤖 Calling ${modelMode} model...`);

        const response = await model.invoke(messages);
        const content = typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);

        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
        const jsonStr = jsonMatch[1]?.trim() || content.trim();

        try {
            const workflow: Workflow = JSON.parse(jsonStr);

            // Validate basic structure
            if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
                throw new Error('Invalid workflow: missing nodes array');
            }

            // Generate IDs if missing
            workflow.nodes = workflow.nodes.map((node, index) => ({
                ...node,
                id: node.id || `node-${index}-${Date.now()}`,
            }));

            console.log(`✅ Generated workflow with ${workflow.nodes.length} nodes`);

            return {
                workflow,
                name: workflow.name || 'Generated Workflow',
                message: 'Workflow generated successfully',
            };
        } catch (parseError) {
            console.error('Failed to parse workflow JSON:', parseError);
            throw new Error(`Failed to parse generated workflow: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
    }
}
