import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import type { Workflow, WorkflowNode } from '@shared/types.js';

/**
 * Workflow modification tools for the ReAct agent
 */

export interface ToolResult {
    success: boolean;
    message: string;
    data?: unknown;
}

// Schema for adding a new node
const addNodeSchema = z.object({
    type: z.string().describe('The n8n node type, e.g., "n8n-nodes-base.slack"'),
    name: z.string().describe('Display name for the node'),
    position: z.object({
        x: z.number().describe('X position on canvas'),
        y: z.number().describe('Y position on canvas')
    }),
    parameters: z.record(z.unknown()).optional().describe('Node-specific parameters')
});

// Schema for updating a node
const updateNodeSchema = z.object({
    nodeId: z.string().describe('ID of the node to update'),
    changes: z.object({
        name: z.string().optional().describe('New display name'),
        parameters: z.record(z.unknown()).optional().describe('Updated parameters'),
        position: z.object({
            x: z.number(),
            y: z.number()
        }).optional().describe('New position')
    })
});

// Schema for deleting a node
const deleteNodeSchema = z.object({
    nodeId: z.string().describe('ID of the node to delete')
});

// Schema for connecting nodes
const connectNodesSchema = z.object({
    fromNodeName: z.string().describe('Name of the source node'),
    toNodeName: z.string().describe('Name of the target node'),
    fromOutput: z.number().default(0).describe('Output index (usually 0)'),
    toInput: z.number().default(0).describe('Input index (usually 0)')
});

/**
 * Create workflow modification tools
 */
export function createWorkflowTools() {
    const addNodeTool = new DynamicStructuredTool({
        name: 'add_node',
        description: 'Add a new node to the workflow canvas. Use this when the user wants to add a new integration or action.',
        schema: addNodeSchema,
        func: async (input): Promise<string> => {
            const node: WorkflowNode = {
                id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: input.name,
                type: input.type,
                typeVersion: 1,
                position: [input.position.x, input.position.y],
                parameters: input.parameters || {},
            };

            return JSON.stringify({
                action: 'add',
                node,
                message: `Added node "${input.name}" (${input.type})`
            });
        }
    });

    const updateNodeTool = new DynamicStructuredTool({
        name: 'update_node',
        description: 'Update an existing node\'s properties. Use this when the user wants to modify a node that\'s already on the canvas.',
        schema: updateNodeSchema,
        func: async (input): Promise<string> => {
            return JSON.stringify({
                action: 'update',
                nodeId: input.nodeId,
                changes: input.changes,
                message: `Updated node ${input.nodeId}`
            });
        }
    });

    const deleteNodeTool = new DynamicStructuredTool({
        name: 'delete_node',
        description: 'Remove a node from the workflow. Use this when the user wants to delete a specific node.',
        schema: deleteNodeSchema,
        func: async (input): Promise<string> => {
            return JSON.stringify({
                action: 'delete',
                nodeId: input.nodeId,
                message: `Deleted node ${input.nodeId}`
            });
        }
    });

    const connectNodesTool = new DynamicStructuredTool({
        name: 'connect_nodes',
        description: 'Create a connection between two nodes. Use this to define the workflow flow from one node to another.',
        schema: connectNodesSchema,
        func: async (input): Promise<string> => {
            return JSON.stringify({
                action: 'connect',
                from: input.fromNodeName,
                to: input.toNodeName,
                fromOutput: input.fromOutput,
                toInput: input.toInput,
                message: `Connected "${input.fromNodeName}" → "${input.toNodeName}"`
            });
        }
    });

    return [addNodeTool, updateNodeTool, deleteNodeTool, connectNodesTool];
}

export type WorkflowAction =
    | { action: 'add'; node: WorkflowNode; message: string }
    | { action: 'update'; nodeId: string; changes: Record<string, unknown>; message: string }
    | { action: 'delete'; nodeId: string; message: string }
    | { action: 'connect'; from: string; to: string; fromOutput: number; toInput: number; message: string };
