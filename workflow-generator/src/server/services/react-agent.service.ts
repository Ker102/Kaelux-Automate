import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createWorkflowTools, type WorkflowAction } from '../tools/workflow-tools.js';
import { getRAGService } from './rag.service.js';
import type { Workflow } from '@shared/types.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface NodeInfo {
    type: string;
    displayName: string;
    category: string;
}

/**
 * ReAct Agent Service for workflow generation and modification
 * Uses LLM with tool binding for structured workflow manipulation
 */
export class ReActAgentService {
    private ragService = getRAGService();
    private nodesRegistry: { nodes: NodeInfo[] };

    constructor() {
        const registryPath = path.join(__dirname, '../data/nodes-registry.json');
        try {
            this.nodesRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
            console.log(`📚 Loaded ${this.nodesRegistry.nodes.length} nodes from registry`);
        } catch (error) {
            console.warn('⚠️ Could not load nodes registry, using empty list');
            this.nodesRegistry = { nodes: [] };
        }
    }

    private getModel(modelMode: 'fast' | 'thinking' | 'thinking-pro') {
        const apiKey = process.env.GEMINI_API_KEY || process.env.N8N_AI_GEMINI_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY required');

        const models = {
            'fast': 'gemini-3-flash-preview',
            'thinking': 'gemini-2.5-pro',
            'thinking-pro': 'gemini-2.5-pro'
        };

        return new ChatGoogleGenerativeAI({
            apiKey,
            model: models[modelMode],
            temperature: 0.3,
        });
    }

    private getSystemPrompt(): string {
        // Group nodes by category - only show top categories
        const nodesByCategory: Record<string, string[]> = {};
        for (const node of this.nodesRegistry.nodes) {
            const cat = node.category || 'Other';
            if (!nodesByCategory[cat]) nodesByCategory[cat] = [];
            const shortName = node.type.replace('n8n-nodes-base.', '');
            nodesByCategory[cat].push(shortName);
        }

        // Only show first 10 per category to keep prompt smaller
        const nodeList = Object.entries(nodesByCategory)
            .slice(0, 10)
            .map(([cat, nodes]) => `**${cat}**: ${nodes.slice(0, 15).join(', ')}`)
            .join('\n');

        return `You are an expert n8n workflow automation engineer. Generate PRODUCTION-READY n8n workflow JSON.

AVAILABLE NODES:
${nodeList}

CRITICAL REQUIREMENTS:
1. ALWAYS include connections between ALL nodes in sequence
2. ALWAYS include realistic parameters with n8n expressions where appropriate
3. Use {{$json.fieldName}} to reference data from previous nodes
4. Position nodes at y=300, starting x=250 and adding 200 for each

EXAMPLE - A complete workflow with proper parameters:
{
  "name": "Fetch and Process Data",
  "nodes": [
    {
      "id": "trigger-1",
      "name": "When clicking 'Test workflow'",
      "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1,
      "position": [250, 300],
      "parameters": {}
    },
    {
      "id": "http-1",
      "name": "Fetch API Data",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4,
      "position": [450, 300],
      "parameters": {
        "url": "https://api.example.com/data",
        "method": "GET",
        "authentication": "none",
        "options": {}
      }
    },
    {
      "id": "set-1",
      "name": "Transform Data",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3,
      "position": [650, 300],
      "parameters": {
        "mode": "manual",
        "duplicateItem": false,
        "assignments": {
          "assignments": [
            {"name": "processed", "value": "={{$json.data}}", "type": "string"}
          ]
        }
      }
    }
  ],
  "connections": {
    "When clicking 'Test workflow'": {"main": [[{"node": "Fetch API Data", "type": "main", "index": 0}]]},
    "Fetch API Data": {"main": [[{"node": "Transform Data", "type": "main", "index": 0}]]}
  }
}

EXPRESSIONS TO USE:
- {{$json.fieldName}} - access field from previous node output
- {{$node["Node Name"].json.field}} - access specific node's output
- {{$now}} - current timestamp
- {{$today}} - today's date

Generate a complete, production-ready workflow. Return ONLY valid JSON.`;
    }

    async generateWithAgent(
        prompt: string,
        modelMode: 'fast' | 'thinking' | 'thinking-pro' = 'fast',
        currentWorkflow?: Workflow
    ): Promise<{
        workflow: Workflow;
        actions: WorkflowAction[];
        reasoning: string;
    }> {
        const model = this.getModel(modelMode);

        // Get RAG context with detailed logging
        let ragContext = '';
        console.log('\n' + '='.repeat(60));
        console.log(`🤖 WORKFLOW GENERATION REQUEST`);
        console.log('='.repeat(60));
        console.log(`📝 User prompt: "${prompt}"`);
        console.log(`⚙️ Model: ${modelMode}`);

        if (this.ragService.isAvailable()) {
            console.log('📚 RAG: Fetching context...');
            ragContext = await this.ragService.getContextForPrompt(prompt, 10, 2);
            if (ragContext) {
                console.log('📚 RAG CONTEXT RECEIVED:');
                console.log('-'.repeat(40));
                console.log(ragContext.substring(0, 1000) + (ragContext.length > 1000 ? '...[truncated]' : ''));
                console.log('-'.repeat(40));
            } else {
                console.log('📚 RAG: No matching context found');
            }
        } else {
            console.log('⚠️ RAG: Not available (check QDRANT_URL and GEMINI_API_KEY)');
        }

        // Build user prompt
        let userPrompt = prompt;
        if (currentWorkflow && currentWorkflow.nodes && currentWorkflow.nodes.length > 0) {
            console.log(`📋 Modifying existing workflow with ${currentWorkflow.nodes.length} nodes`);
            userPrompt = `CURRENT WORKFLOW:\n${JSON.stringify(currentWorkflow, null, 2)}\n\nMODIFY IT: ${prompt}`;
        } else {
            console.log('🆕 Creating new workflow from scratch');
        }

        console.log(`\n🚀 Sending to LLM...`);
        const startTime = Date.now();

        const response = await model.invoke([
            new SystemMessage(this.getSystemPrompt() + (ragContext ? `\n\n${ragContext}` : '')),
            new HumanMessage(userPrompt),
        ]);

        const elapsed = Date.now() - startTime;
        console.log(`⏱️ LLM response received in ${elapsed}ms`);

        const content = typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);

        console.log(`📤 Response length: ${content.length} chars`);

        // Extract JSON from response
        let jsonStr = content.trim();

        // Handle markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            console.log('📝 Extracted JSON from markdown code block');
            jsonStr = jsonMatch[1].trim();
        }

        try {
            const workflow: Workflow = JSON.parse(jsonStr);
            console.log(`\n✅ WORKFLOW GENERATED:`);
            console.log(`   📦 Name: ${workflow.name}`);
            console.log(`   🔢 Nodes: ${workflow.nodes?.length || 0}`);
            console.log(`   🔗 Connections: ${Object.keys(workflow.connections || {}).length}`);
            console.log('='.repeat(60) + '\n');

            // Create synthetic actions from the generated workflow
            const actions: WorkflowAction[] = workflow.nodes.map(node => ({
                action: 'add' as const,
                node: {
                    id: node.id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: node.name,
                    type: node.type,
                    typeVersion: node.typeVersion || 1,
                    position: node.position,
                    parameters: node.parameters || {},
                },
                message: `Added ${node.name}`,
            }));

            console.log(`✅ Generated workflow with ${workflow.nodes.length} nodes and ${Object.keys(workflow.connections || {}).length} connections`);

            return {
                workflow,  // Return the full workflow including connections!
                actions,
                reasoning: `Generated workflow: ${workflow.name || 'Untitled'}`,
            };
        } catch (parseError) {
            console.error('Failed to parse JSON:', parseError);
            console.error('Raw response:', content.substring(0, 500));
            throw new Error(`Failed to parse workflow JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
    }

    applyActionsToWorkflow(baseWorkflow: Workflow, generatedWorkflow: Workflow): Workflow {
        // If we have a generated workflow with nodes, use it directly
        if (generatedWorkflow && generatedWorkflow.nodes?.length > 0) {
            return {
                name: generatedWorkflow.name || baseWorkflow.name || 'Generated Workflow',
                nodes: generatedWorkflow.nodes,
                connections: generatedWorkflow.connections || {},
            };
        }

        // Fallback: merge base with any actions
        return {
            name: baseWorkflow.name || 'Generated Workflow',
            nodes: [...(baseWorkflow.nodes || [])],
            connections: { ...(baseWorkflow.connections || {}) },
        };
    }
}

// Singleton
let reactAgentInstance: ReActAgentService | null = null;
export function getReActAgentService(): ReActAgentService {
    if (!reactAgentInstance) {
        reactAgentInstance = new ReActAgentService();
    }
    return reactAgentInstance;
}
