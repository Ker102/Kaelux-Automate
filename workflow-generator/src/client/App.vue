<script setup lang="ts">
/**
 * Main App - Workflow Generator with Canvas Sync
 * The canvas state is always sent to the model when generating,
 * so manual edits are understood by the AI.
 */
import { ref } from 'vue';
import PromptInput from './components/PromptInput.vue';
import WorkflowCanvas from './components/WorkflowCanvas.vue';
import JsonExport from './components/JsonExport.vue';
import type { Workflow } from '@shared/types';

const workflow = ref<Workflow | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

// Handle workflow updates from canvas (editing, connecting, moving)
function handleWorkflowUpdate(updatedWorkflow: Workflow) {
  workflow.value = updatedWorkflow;
  console.log('📋 Canvas updated:', {
    nodes: updatedWorkflow.nodes?.length || 0,
    connections: Object.keys(updatedWorkflow.connections || {}).length
  });
}

async function handleGenerate(prompt: string, modelMode: 'fast' | 'thinking' | 'thinking-pro') {
  isLoading.value = true;
  error.value = null;

  try {
    // Always send current workflow state so model can modify it
    const requestBody: {
      prompt: string;
      modelMode: string;
      currentWorkflow?: Workflow;
    } = { prompt, modelMode };

    // If we have an existing workflow, send it for modification
    if (workflow.value && workflow.value.nodes?.length > 0) {
      requestBody.currentWorkflow = workflow.value;
      console.log('📤 Sending current workflow for modification:', {
        nodes: workflow.value.nodes.length,
        connections: Object.keys(workflow.value.connections || {}).length
      });
    } else {
      console.log('🆕 Creating new workflow from scratch');
    }

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate workflow');
    }

    workflow.value = data.workflow;
    console.log('✅ Received workflow:', {
      nodes: data.workflow?.nodes?.length || 0,
      connections: Object.keys(data.workflow?.connections || {}).length
    });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error occurred';
  } finally {
    isLoading.value = false;
  }
}

// Clear workflow and start fresh
function clearWorkflow() {
  workflow.value = null;
  error.value = null;
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="logo">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">Workflow Generator</span>
      </div>
      <div class="header-actions">
        <button 
          v-if="workflow" 
          class="clear-btn"
          @click="clearWorkflow"
        >
          🗑️ Clear
        </button>
        <div class="tagline">Powered by Kaelux AI</div>
      </div>
    </header>

    <main class="main">
      <aside class="sidebar">
        <PromptInput 
          :is-loading="isLoading" 
          @generate="handleGenerate" 
        />
        
        <div v-if="workflow" class="workflow-status">
          <div class="status-item">
            <span class="status-label">Nodes</span>
            <span class="status-value">{{ workflow.nodes?.length || 0 }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">Connections</span>
            <span class="status-value">{{ Object.keys(workflow.connections || {}).length }}</span>
          </div>
        </div>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <JsonExport 
          v-if="workflow" 
          :workflow="workflow" 
        />
      </aside>

      <section class="canvas-container">
        <WorkflowCanvas 
          :workflow="workflow" 
          :is-loading="isLoading"
          @update:workflow="handleWorkflowUpdate"
        />
      </section>
    </main>
  </div>
</template>

<style scoped lang="scss">
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 600;
}

.logo-icon {
  font-size: 24px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.clear-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
  
  &:hover {
    background: rgba(239, 68, 68, 0.2);
    border-color: #ef4444;
  }
}

.tagline {
  color: var(--text-secondary);
  font-size: 14px;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 380px;
  padding: 24px;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.workflow-status {
  display: flex;
  gap: 12px;
}

.status-item {
  flex: 1;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.status-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.status-value {
  font-size: 20px;
  font-weight: 600;
  color: var(--accent);
}

.canvas-container {
  flex: 1;
  position: relative;
  background: var(--bg-primary);
}

.error-message {
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--error);
  border-radius: 8px;
  color: var(--error);
  font-size: 14px;
}
</style>
