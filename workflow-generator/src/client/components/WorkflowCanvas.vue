<script setup lang="ts">
import { computed, watch } from 'vue';
import { VueFlow, useVueFlow, type Node, type Edge, Position } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import type { Workflow } from '@shared/types';
import WorkflowNode from './WorkflowNode.vue';

const props = defineProps<{
  workflow: Workflow | null;
  isLoading: boolean;
}>();

const { fitView } = useVueFlow();

// Convert n8n workflow to Vue Flow nodes/edges
const nodes = computed<Node[]>(() => {
  if (!props.workflow?.nodes) return [];
  
  return props.workflow.nodes.map((node) => ({
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
});

const edges = computed<Edge[]>(() => {
  if (!props.workflow?.connections) return [];
  
  const result: Edge[] = [];
  const nodeNameToId = new Map(
    props.workflow.nodes.map(n => [n.name, n.id])
  );

  Object.entries(props.workflow.connections).forEach(([sourceNode, targets]) => {
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
});

// Fit view when workflow changes
watch(() => props.workflow, (newWorkflow) => {
  if (newWorkflow) {
    setTimeout(() => fitView({ padding: 0.2 }), 100);
  }
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
      :nodes="nodes"
      :edges="edges"
      :fit-view-on-init="true"
      :nodes-draggable="true"
      :nodes-connectable="false"
      :edges-updatable="false"
    >
      <template #node-workflow="nodeProps">
        <WorkflowNode v-bind="nodeProps" />
      </template>
      
      <Background />
      <Controls />
      <MiniMap />
    </VueFlow>
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
</style>
