<script setup lang="ts">
/**
 * WorkflowCanvas - Vue Flow canvas with node editing and connection support
 * Tracks all changes and syncs with model via currentWorkflow
 */
import { ref, computed, watch } from 'vue';
import { VueFlow, useVueFlow, type Node, type Edge, Position, type Connection } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import type { Workflow, WorkflowNode as WFNode } from '@shared/types';
import WorkflowNode from './WorkflowNode.vue';
import NodeEditor from './NodeEditor.vue';

const props = defineProps<{
  workflow: Workflow | null;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  'update:workflow': [workflow: Workflow];
}>();

const { fitView, onConnect, onNodesChange, onEdgesChange } = useVueFlow();

// Local state for tracking changes
const selectedNodeId = ref<string | null>(null);
const localNodes = ref<Node[]>([]);
const localEdges = ref<Edge[]>([]);

// Selected node data for editor
const selectedNode = computed(() => {
  if (!selectedNodeId.value) return null;
  const node = localNodes.value.find(n => n.id === selectedNodeId.value);
  if (!node) return null;
  return {
    id: node.id,
    label: node.data.label,
    type: node.data.type,
    typeVersion: node.data.typeVersion,
    parameters: node.data.parameters,
  };
});

// Convert n8n workflow to Vue Flow nodes
function workflowToNodes(workflow: Workflow): Node[] {
  if (!workflow?.nodes) return [];
  return workflow.nodes.map((node) => ({
    id: node.id,
    type: 'workflow',
    position: { x: node.position[0], y: node.position[1] },
    data: {
      label: node.name,
      type: node.type,
      typeVersion: node.typeVersion,
      parameters: node.parameters,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));
}

// Convert n8n connections to Vue Flow edges
function workflowToEdges(workflow: Workflow): Edge[] {
  if (!workflow?.connections) return [];
  
  const result: Edge[] = [];
  const nodeNameToId = new Map(
    workflow.nodes.map(n => [n.name, n.id])
  );

  Object.entries(workflow.connections).forEach(([sourceNode, targets]) => {
    Object.entries(targets).forEach(([, connectionSets]) => {
      connectionSets.forEach((connections, outputIndex) => {
        connections.forEach((conn) => {
          const sourceId = nodeNameToId.get(sourceNode);
          const targetId = nodeNameToId.get(conn.node);
          
          if (sourceId && targetId) {
            result.push({
              id: `${sourceId}-${targetId}-${outputIndex}-${conn.index}`,
              source: sourceId,
              target: targetId,
              animated: true,
            });
          }
        });
      });
    });
  });

  return result;
}

// Convert Vue Flow state back to n8n workflow format
function nodesToWorkflow(): Workflow {
  const nodes: WFNode[] = localNodes.value.map(n => ({
    id: n.id,
    name: n.data.label,
    type: n.data.type,
    typeVersion: n.data.typeVersion,
    position: [n.position.x, n.position.y],
    parameters: n.data.parameters || {},
  }));

  const nodeIdToName = new Map(nodes.map(n => [n.id, n.name]));
  const connections: Workflow['connections'] = {};

  localEdges.value.forEach(edge => {
    const sourceName = nodeIdToName.get(edge.source);
    const targetName = nodeIdToName.get(edge.target);
    
    if (sourceName && targetName) {
      if (!connections[sourceName]) {
        connections[sourceName] = { main: [[]] };
      }
      connections[sourceName].main[0].push({
        node: targetName,
        type: 'main',
        index: 0,
      });
    }
  });

  return {
    name: props.workflow?.name || 'Workflow',
    nodes,
    connections,
  };
}

// Emit updated workflow to parent
function emitUpdate() {
  const workflow = nodesToWorkflow();
  emit('update:workflow', workflow);
}

// Watch for workflow prop changes
watch(() => props.workflow, (newWorkflow) => {
  if (newWorkflow) {
    localNodes.value = workflowToNodes(newWorkflow);
    localEdges.value = workflowToEdges(newWorkflow);
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  } else {
    localNodes.value = [];
    localEdges.value = [];
  }
}, { immediate: true });

// Handle node selection
function handleNodeClick(event: { node: Node }) {
  selectedNodeId.value = event.node.id;
}

function closeEditor() {
  selectedNodeId.value = null;
}

// Handle node parameter update from editor
function handleNodeUpdate(nodeId: string, parameters: Record<string, unknown>) {
  const nodeIndex = localNodes.value.findIndex(n => n.id === nodeId);
  if (nodeIndex !== -1) {
    localNodes.value[nodeIndex].data.parameters = parameters;
    emitUpdate();
  }
}

// Handle new connection
onConnect((connection: Connection) => {
  const edgeId = `${connection.source}-${connection.target}`;
  const exists = localEdges.value.some(e => e.id === edgeId);
  
  if (!exists) {
    localEdges.value.push({
      id: edgeId,
      source: connection.source!,
      target: connection.target!,
      animated: true,
    });
    emitUpdate();
  }
});

// Handle node position changes
onNodesChange((changes) => {
  changes.forEach(change => {
    if (change.type === 'position' && change.position) {
      const node = localNodes.value.find(n => n.id === change.id);
      if (node) {
        node.position = change.position;
      }
    }
  });
  // Debounce position updates
  emitUpdate();
});

// Handle edge deletions
onEdgesChange((changes) => {
  changes.forEach(change => {
    if (change.type === 'remove') {
      localEdges.value = localEdges.value.filter(e => e.id !== change.id);
      emitUpdate();
    }
  });
});
</script>

<template>
  <div class="workflow-canvas">
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="spinner large" />
        <p>Generating your workflow...</p>
      </div>
    </div>

    <div v-else-if="!workflow" class="empty-state">
      <div class="empty-icon">🎨</div>
      <h3>No workflow yet</h3>
      <p>Enter a prompt and click Generate to create your workflow</p>
    </div>

    <VueFlow
      v-else
      v-model:nodes="localNodes"
      v-model:edges="localEdges"
      :fit-view-on-init="true"
      :nodes-draggable="true"
      :nodes-connectable="true"
      :edges-updatable="true"
      :delete-key-code="'Delete'"
      @node-click="handleNodeClick"
    >
      <template #node-workflow="nodeProps">
        <WorkflowNode v-bind="nodeProps" />
      </template>
      
      <Background />
      <Controls />
      <MiniMap />
    </VueFlow>

    <!-- Node Editor Panel -->
    <NodeEditor
      :node="selectedNode"
      @close="closeEditor"
      @update="handleNodeUpdate"
    />
    
    <!-- Connection hint -->
    <div v-if="workflow && !selectedNodeId" class="canvas-hint">
      <span>💡 Drag from handle to connect • Click node to edit • Delete key to remove</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.workflow-canvas {
  width: 100%;
  height: 100%;
  position: relative;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 10, 15, 0.8);
  z-index: 10;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  color: var(--text-secondary);

  .spinner.large {
    width: 40px;
    height: 40px;
    border-width: 3px;
    border-color: var(--accent);
    border-top-color: transparent;
  }
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);

  .empty-icon {
    font-size: 48px;
    margin-bottom: 8px;
  }

  h3 {
    font-size: 18px;
    color: var(--text-primary);
  }

  p {
    font-size: 14px;
  }
}

.canvas-hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(26, 26, 36, 0.9);
  border: 1px solid #2a2a3a;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  color: #8b8fa3;
  pointer-events: none;
}
</style>
