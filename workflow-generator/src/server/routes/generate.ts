import { Router } from 'express';
import type { Request, Response } from 'express';
import { WorkflowGeneratorService } from '../services/workflow-generator.service.js';
import type { GenerateRequest, GenerateResponse, GenerateError } from '@shared/types.js';

export const generateRouter = Router();

const generatorService = new WorkflowGeneratorService();

/**
 * POST /api/generate
 * Generate an n8n workflow from a natural language prompt
 */
generateRouter.post('/generate', async (
    req: Request<object, GenerateResponse | GenerateError, GenerateRequest>,
    res: Response<GenerateResponse | GenerateError>
) => {
    try {
        const { prompt, modelMode = 'fast' } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            res.status(400).json({ error: 'Prompt is required and must be a string' });
            return;
        }

        if (prompt.length > 5000) {
            res.status(400).json({ error: 'Prompt must be less than 5000 characters' });
            return;
        }

        console.log(`📝 Generating workflow for prompt: "${prompt.substring(0, 50)}..."`);

        const result = await generatorService.generate(prompt, modelMode);

        res.json(result);
    } catch (error) {
        console.error('Generation error:', error);

        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        res.status(500).json({
            error: 'Failed to generate workflow',
            details: message
        });
    }
});
