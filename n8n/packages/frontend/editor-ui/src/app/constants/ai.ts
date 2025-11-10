export const ASK_AI_MAX_PROMPT_LENGTH = 600;
export const ASK_AI_MIN_PROMPT_LENGTH = 15;
export const ASK_AI_LOADING_DURATION_MS = 12000;
export const ASK_AI_SLIDE_OUT_DURATION_MS = 200;
export const PLAN_APPROVAL_MESSAGE = 'Proceed with the plan';

export const AI_NODES_PACKAGE_NAME = '@n8n/n8n-nodes-langchain';

export const AI_ASSISTANT_MAX_CONTENT_LENGTH = 100; // in kilobytes

export const AI_WORKFLOW_ENDPOINT =
	import.meta.env.VITE_AI_WORKFLOW_ENDPOINT ?? 'http://localhost:3000/api/ai/workflow';

export const AI_SAMPLE_PROMPTS_ENDPOINT =
	import.meta.env.VITE_AI_SAMPLE_PROMPTS_ENDPOINT ?? 'http://localhost:3000/api/ai/prompts';
