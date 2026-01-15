import { Router } from 'express';
import type { Request, Response } from 'express';
import { getReActAgentService } from '../services/react-agent.service.js';
import type { GenerateRequest, GenerateResponse, GenerateError, Workflow } from '@shared/types.js';

export const generateRouter = Router();

/**
 * POST /api/generate
 * Generate or modify n8n workflow using ReAct agent with tools
 * All modes (fast/thinking/pro) use the agent approach
 */
generateRouter.post('/generate', async (
    req: Request<object, GenerateResponse | GenerateError, GenerateRequest>,
    res: Response<GenerateResponse | GenerateError>
) => {
    try {
        const { prompt, modelMode = 'fast', currentWorkflow } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            res.status(400).json({ error: 'Prompt is required and must be a string' });
            return;
        }

        if (prompt.length > 5000) {
            res.status(400).json({ error: 'Prompt must be less than 5000 characters' });
            return;
        }

        console.log(`🤖 Generating workflow (${modelMode} mode): "${prompt.substring(0, 50)}..."`);

        const agentService = getReActAgentService();
        const { workflow, actions, reasoning } = await agentService.generateWithAgent(
            prompt,
            modelMode,
            currentWorkflow
        );

        res.json({
            workflow,
            name: workflow.name,
            message: `Generated with ${workflow.nodes?.length || 0} nodes and ${Object.keys(workflow.connections || {}).length} connections`,
        });
    } catch (error) {
        console.error('Generation error:', error);

        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        res.status(500).json({
            error: 'Failed to generate workflow',
            details: message
        });
    }
});

/**
 * GET /api/nodes
 * Get all available n8n node types
 */
generateRouter.get('/nodes', async (_req, res) => {
    try {
        const agentService = getReActAgentService();
        // Access the nodes registry via the service
        res.json({
            success: true,
            message: 'Node registry available - use POST /api/generate to create workflows'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get nodes' });
    }
});
