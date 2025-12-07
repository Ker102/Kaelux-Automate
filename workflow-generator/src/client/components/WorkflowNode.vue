<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core';

defineProps<{
  data: {
    label: string;
    type: string;
    typeVersion: number;
    parameters: Record<string, unknown>;
  };
}>();

// Get node icon based on type
function getNodeIcon(type: string): string {
  const iconMap: Record<string, string> = {
    'n8n-nodes-base.manualTrigger': '👆',
    'n8n-nodes-base.scheduleTrigger': '⏰',
    'n8n-nodes-base.webhookTrigger': '🔗',
    'n8n-nodes-base.httpRequest': '🌐',
    'n8n-nodes-base.set': '📝',
    'n8n-nodes-base.if': '🔀',
    'n8n-nodes-base.switch': '🔀',
    'n8n-nodes-base.merge': '🔄',
    'n8n-nodes-base.splitInBatches': '📦',
    'n8n-nodes-base.code': '💻',
    'n8n-nodes-base.function': '⚡',
    'n8n-nodes-base.gmail': '📧',
    'n8n-nodes-base.slack': '💬',
    'n8n-nodes-base.notion': '📓',
    'n8n-nodes-base.googleSheets': '📊',
    'n8n-nodes-base.postgres': '🐘',
    'n8n-nodes-base.mysql': '🐬',
    'n8n-nodes-base.mongodb': '🍃',
  };
  
  return iconMap[type] || '⚙️';
}

function getShortType(type: string): string {
  return type.replace('n8n-nodes-base.', '').replace('Tool', '');
}
</script>

<template>
  <div class="workflow-node">
    <Handle type="target" :position="Position.Left" />
    
    <div class="node-content">
      <div class="node-icon">{{ getNodeIcon(data.type) }}</div>
      <div class="node-info">
        <div class="node-label">{{ data.label }}</div>
        <div class="node-type">{{ getShortType(data.type) }}</div>
      </div>
    </div>
    
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped lang="scss">
.workflow-node {
  display: flex;
  align-items: center;
  min-width: 180px;
  padding: 12px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--accent);
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.15);
  }
}

.node-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.node-icon {
  font-size: 24px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border-radius: 8px;
}

.node-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.node-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.node-type {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: capitalize;
}
</style>
