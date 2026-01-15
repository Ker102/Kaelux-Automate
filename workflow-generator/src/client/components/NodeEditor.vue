<script setup lang="ts">
/**
 * NodeEditor Panel - Appears when clicking a node
 * Allows editing node parameters and expressions
 */
import { ref, computed, watch } from 'vue';

interface NodeData {
  id: string;
  label: string;
  type: string;
  typeVersion: number;
  parameters: Record<string, unknown>;
}

const props = defineProps<{
  node: NodeData | null;
}>();

const emit = defineEmits<{
  close: [];
  update: [id: string, parameters: Record<string, unknown>];
}>();

const localParams = ref<Record<string, unknown>>({});
const jsonMode = ref(false);
const jsonText = ref('');
const jsonError = ref<string | null>(null);

// Sync props to local state when node changes
watch(() => props.node, (newNode) => {
  if (newNode) {
    localParams.value = JSON.parse(JSON.stringify(newNode.parameters || {}));
    jsonText.value = JSON.stringify(newNode.parameters || {}, null, 2);
    jsonError.value = null;
  }
}, { immediate: true });

const shortType = computed(() => props.node?.type.replace('n8n-nodes-base.', '') || '');

// Get parameter entries for the form
const paramEntries = computed(() => {
  return Object.entries(localParams.value).map(([key, value]) => ({
    key,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''),
    isExpression: typeof value === 'string' && value.startsWith('={{'),
    isObject: typeof value === 'object',
  }));
});

function updateParam(key: string, value: string) {
  // Try to parse as JSON if it looks like JSON
  try {
    if (value.startsWith('{') || value.startsWith('[')) {
      localParams.value[key] = JSON.parse(value);
    } else {
      localParams.value[key] = value;
    }
  } catch {
    localParams.value[key] = value;
  }
  syncJsonText();
}

function addParam() {
  const key = `newParam${Object.keys(localParams.value).length + 1}`;
  localParams.value[key] = '';
  syncJsonText();
}

function removeParam(key: string) {
  delete localParams.value[key];
  syncJsonText();
}

function syncJsonText() {
  jsonText.value = JSON.stringify(localParams.value, null, 2);
  jsonError.value = null;
}

function handleJsonEdit(text: string) {
  jsonText.value = text;
  try {
    localParams.value = JSON.parse(text);
    jsonError.value = null;
  } catch (e) {
    jsonError.value = 'Invalid JSON';
  }
}

function saveChanges() {
  if (!props.node || jsonError.value) return;
  emit('update', props.node.id, localParams.value);
  emit('close');
}

function discardChanges() {
  emit('close');
}
</script>

<template>
  <div v-if="node" class="node-editor">
    <div class="editor-header">
      <div class="editor-title">
        <span class="node-type">{{ shortType }}</span>
        <h3>{{ node.label }}</h3>
      </div>
      <button class="close-btn" @click="discardChanges">×</button>
    </div>
    
    <div class="editor-tabs">
      <button 
        :class="['tab', { active: !jsonMode }]" 
        @click="jsonMode = false"
      >
        Parameters
      </button>
      <button 
        :class="['tab', { active: jsonMode }]" 
        @click="jsonMode = true"
      >
        JSON
      </button>
    </div>
    
    <div class="editor-body">
      <!-- Form Mode -->
      <div v-if="!jsonMode" class="params-form">
        <div v-if="paramEntries.length === 0" class="no-params">
          No parameters configured
        </div>
        
        <div v-for="param in paramEntries" :key="param.key" class="param-row">
          <label class="param-label">
            {{ param.key }}
            <span v-if="param.isExpression" class="expression-badge">expr</span>
          </label>
          <div class="param-input-wrapper">
            <textarea
              v-if="param.isObject || param.value.length > 50"
              :value="param.value"
              class="param-input textarea"
              rows="3"
              @input="updateParam(param.key, ($event.target as HTMLTextAreaElement).value)"
            />
            <input
              v-else
              :value="param.value"
              class="param-input"
              :class="{ expression: param.isExpression }"
              @input="updateParam(param.key, ($event.target as HTMLInputElement).value)"
            />
            <button class="remove-btn" @click="removeParam(param.key)">×</button>
          </div>
        </div>
        
        <button class="add-param-btn" @click="addParam">
          + Add Parameter
        </button>
      </div>
      
      <!-- JSON Mode -->
      <div v-else class="json-editor">
        <textarea
          :value="jsonText"
          class="json-textarea"
          spellcheck="false"
          @input="handleJsonEdit(($event.target as HTMLTextAreaElement).value)"
        />
        <div v-if="jsonError" class="json-error">{{ jsonError }}</div>
      </div>
    </div>
    
    <div class="editor-footer">
      <button class="btn btn-secondary" @click="discardChanges">Cancel</button>
      <button class="btn btn-primary" :disabled="!!jsonError" @click="saveChanges">
        Save Changes
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.node-editor {
  position: absolute;
  right: 24px;
  top: 24px;
  width: 360px;
  max-height: calc(100% - 48px);
  background: #1a1a24;
  border: 1px solid #2a2a3a;
  border-radius: 12px;
  z-index: 100;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.editor-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #2a2a3a;
}

.editor-title {
  h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: #fff;
  }
}

.node-type {
  font-size: 12px;
  color: #8b8fa3;
  text-transform: capitalize;
}

.close-btn {
  background: none;
  border: none;
  color: #8b8fa3;
  font-size: 24px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  
  &:hover {
    color: #fff;
  }
}

.editor-tabs {
  display: flex;
  padding: 0 16px;
  border-bottom: 1px solid #2a2a3a;
}

.tab {
  background: none;
  border: none;
  color: #8b8fa3;
  padding: 12px 16px;
  font-size: 13px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  
  &.active {
    color: #fff;
    border-bottom-color: #6366f1;
  }
  
  &:hover:not(.active) {
    color: #a0a0b0;
  }
}

.editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.params-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.no-params {
  color: #8b8fa3;
  text-align: center;
  padding: 24px;
  font-size: 14px;
}

.param-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-label {
  font-size: 12px;
  color: #a0a0b0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.expression-badge {
  background: #5a4caf;
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
}

.param-input-wrapper {
  display: flex;
  gap: 8px;
}

.param-input {
  flex: 1;
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 6px;
  padding: 8px 12px;
  color: #fff;
  font-size: 13px;
  font-family: 'Monaco', 'Menlo', monospace;
  
  &:focus {
    outline: none;
    border-color: #6366f1;
  }
  
  &.expression {
    border-color: #5a4caf;
    background: rgba(90, 76, 175, 0.1);
  }
  
  &.textarea {
    resize: vertical;
    min-height: 60px;
  }
}

.remove-btn {
  background: none;
  border: 1px solid #2a2a3a;
  color: #8b8fa3;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  
  &:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
    color: #ef4444;
  }
}

.add-param-btn {
  background: none;
  border: 1px dashed #2a2a3a;
  color: #8b8fa3;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  
  &:hover {
    border-color: #6366f1;
    color: #6366f1;
  }
}

.json-editor {
  height: 300px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.json-textarea {
  flex: 1;
  background: #12121a;
  border: 1px solid #2a2a3a;
  border-radius: 6px;
  padding: 12px;
  color: #fff;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 12px;
  resize: none;
  
  &:focus {
    outline: none;
    border-color: #6366f1;
  }
}

.json-error {
  color: #ef4444;
  font-size: 12px;
}

.editor-footer {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-top: 1px solid #2a2a3a;
}

.btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.btn-secondary {
  background: #2a2a3a;
  color: #fff;
  
  &:hover {
    background: #3a3a4a;
  }
}

.btn-primary {
  background: #6366f1;
  color: #fff;
  
  &:hover:not(:disabled) {
    background: #5558e3;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
