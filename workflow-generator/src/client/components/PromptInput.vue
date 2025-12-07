<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  isLoading: boolean;
}>();

const emit = defineEmits<{
  generate: [prompt: string, modelMode: 'fast' | 'thinking' | 'thinking-pro'];
}>();

const prompt = ref('');
const modelMode = ref<'fast' | 'thinking' | 'thinking-pro'>('fast');

const examplePrompts = [
  'Fetch data from an API and send it to Slack',
  'Monitor a Google Sheet and send email notifications',
  'Create a workflow that processes webhooks and stores data',
  'Scrape a website and save results to a database',
];

function handleSubmit() {
  if (!prompt.value.trim() || props.isLoading) return;
  emit('generate', prompt.value.trim(), modelMode.value);
}

function useExample(example: string) {
  prompt.value = example;
}
</script>

<template>
  <div class="prompt-input">
    <h2 class="title">Generate Workflow</h2>
    
    <form @submit.prevent="handleSubmit" class="form">
      <div class="field">
        <label for="prompt">Describe your workflow</label>
        <textarea
          id="prompt"
          v-model="prompt"
          placeholder="e.g., Create a workflow that fetches data from an API every hour and sends a summary to Slack..."
          :disabled="isLoading"
          rows="4"
        />
      </div>

      <div class="field">
        <label>Model</label>
        <div class="model-selector">
          <button
            type="button"
            :class="['model-btn', { active: modelMode === 'fast' }]"
            @click="modelMode = 'fast'"
          >
            ⚡ Fast
          </button>
          <button
            type="button"
            :class="['model-btn', { active: modelMode === 'thinking' }]"
            @click="modelMode = 'thinking'"
          >
            🧠 Thinking
          </button>
          <button
            type="button"
            :class="['model-btn', { active: modelMode === 'thinking-pro' }]"
            @click="modelMode = 'thinking-pro'"
          >
            🚀 Pro
          </button>
        </div>
      </div>

      <button 
        type="submit" 
        class="btn btn-primary submit-btn"
        :disabled="!prompt.trim() || isLoading"
      >
        <span v-if="isLoading" class="spinner" />
        <span v-else>✨</span>
        {{ isLoading ? 'Generating...' : 'Generate Workflow' }}
      </button>
    </form>

    <div class="examples">
      <p class="examples-label">Try an example:</p>
      <div class="examples-list">
        <button
          v-for="example in examplePrompts"
          :key="example"
          type="button"
          class="example-btn"
          @click="useExample(example)"
        >
          {{ example }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.prompt-input {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 500;
  }
}

.model-selector {
  display: flex;
  gap: 8px;
}

.model-btn {
  flex: 1;
  padding: 10px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--border);
    color: var(--text-primary);
  }

  &.active {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }
}

.submit-btn {
  width: 100%;
  padding: 14px 20px;
  font-size: 15px;
}

.examples {
  border-top: 1px solid var(--border);
  padding-top: 16px;
}

.examples-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.examples-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.example-btn {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: var(--border);
    color: var(--text-primary);
  }
}
</style>
