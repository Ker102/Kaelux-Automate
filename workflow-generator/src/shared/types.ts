/**
 * Shared types for the Workflow Generator application
 */

/**
 * n8n Workflow JSON structure (simplified)
 */
export interface WorkflowNode {
    id: string;
    name: string;
    type: string;
    typeVersion: number;
    position: [number, number];
    parameters: Record<string, unknown>;
    credentials?: Record<string, { id: string; name: string }>;
}

export interface WorkflowConnection {
    node: string;
    type: string;
    index: number;
}

export interface Workflow {
    name: string;
    nodes: WorkflowNode[];
    connections: Record<string, Record<string, WorkflowConnection[][]>>;
    settings?: Record<string, unknown>;
    staticData?: Record<string, unknown>;
}

/**
 * API Request/Response types
 */
export interface GenerateRequest {
    prompt: string;
    modelMode?: 'fast' | 'thinking' | 'thinking-pro';
    currentWorkflow?: Workflow;
}

export interface GenerateResponse {
    workflow: Workflow;
    name: string;
    message?: string;
}

export interface GenerateError {
    error: string;
    details?: string;
}

/**
 * Canvas node data for Vue Flow rendering
 */
export interface CanvasNodeData {
    label: string;
    type: string;
    typeVersion: number;
    parameters: Record<string, unknown>;
    icon?: string;
}
