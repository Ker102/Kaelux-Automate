<script setup lang="ts">
import { ref } from 'vue';
import type { Workflow } from '@shared/types';

const props = defineProps<{
  workflow: Workflow;
}>();

const copied = ref(false);

function getWorkflowJson(): string {
  return JSON.stringify(props.workflow, null, 2);
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(getWorkflowJson());
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
}

function downloadJson() {
  const blob = new Blob([getWorkflowJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${props.workflow.name || 'workflow'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="json-export">
    <div class="export-header">
      <h3>Export Workflow</h3>
      <span class="node-count">{{ workflow.nodes.length }} nodes</span>
    </div>

    <div class="export-actions">
      <button class="btn btn-secondary" @click="copyToClipboard">
        <span v-if="copied">✓</span>
        <span v-else>📋</span>
        {{ copied ? 'Copied!' : 'Copy JSON' }}
      </button>
      
      <button class="btn btn-primary" @click="downloadJson">
        💾 Download
      </button>
    </div>

    <div class="json-preview">
      <pre><code>{{ getWorkflowJson().substring(0, 500) }}{{ getWorkflowJson().length > 500 ? '...' : '' }}</code></pre>
    </div>

    <p class="import-hint">
      Import this JSON file into n8n to run your workflow
    </p>
  </div>
</template>

<style scoped lang="scss">
.json-export {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.export-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  h3 {
    font-size: 15px;
    font-weight: 600;
  }

  .node-count {
    font-size: 12px;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    padding: 4px 8px;
    border-radius: 4px;
  }
}

.export-actions {
  display: flex;
  gap: 8px;

  .btn {
    flex: 1;
    padding: 10px 16px;
    font-size: 13px;
  }
}

.json-preview {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  max-height: 150px;
  overflow: auto;

  pre {
    margin: 0;
    font-family: 'Fira Code', 'Monaco', monospace;
    font-size: 11px;
    color: var(--text-secondary);
    white-space: pre-wrap;
    word-break: break-all;
  }
}

.import-hint {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
}
</style>
