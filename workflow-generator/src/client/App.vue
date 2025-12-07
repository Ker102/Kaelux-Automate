<script setup lang="ts">
import { ref } from 'vue';
import PromptInput from './components/PromptInput.vue';
import WorkflowCanvas from './components/WorkflowCanvas.vue';
import JsonExport from './components/JsonExport.vue';
import type { Workflow } from '@shared/types';

const workflow = ref<Workflow | null>(null);
const isLoading = ref(false);
const error = ref<string | null>(null);

async function handleGenerate(prompt: string, modelMode: 'fast' | 'thinking' | 'thinking-pro') {
  isLoading.value = true;
  error.value = null;
  workflow.value = null;

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, modelMode }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to generate workflow');
    }

    workflow.value = data.workflow;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Unknown error occurred';
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="logo">
        <span class="logo-icon">⚡</span>
        <span class="logo-text">Workflow Generator</span>
      </div>
      <div class="tagline">Powered by Kaelux AI</div>
    </header>

    <main class="main">
      <aside class="sidebar">
        <PromptInput 
          :is-loading="isLoading" 
          @generate="handleGenerate" 
        />
        
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
