<script setup lang="ts">
/**
 * n8n-style WorkflowNode component with real SVG icons
 * Replicates the exact styling from n8n's CanvasNodeDefault.vue
 */
import { Handle, Position } from '@vue-flow/core';
import { computed, ref } from 'vue';

const props = defineProps<{
  data: {
    label: string;
    type: string;
    typeVersion: number;
    parameters: Record<string, unknown>;
  };
  selected?: boolean;
}>();

// Determine if this is a trigger node
const isTrigger = computed(() => {
  const type = props.data.type.toLowerCase();
  return type.includes('trigger') || type.includes('webhook');
});

// Map node types to icon filenames
const iconMap: Record<string, string> = {
  // Core nodes
  'n8n-nodes-base.manualTrigger': 'manualTrigger',
  'n8n-nodes-base.scheduleTrigger': 'scheduleTrigger',
  'n8n-nodes-base.webhook': 'webhook',
  'n8n-nodes-base.code': 'code',
  'n8n-nodes-base.set': 'set',
  'n8n-nodes-base.if': 'if',
  'n8n-nodes-base.switch': 'switch',
  'n8n-nodes-base.merge': 'merge',
  'n8n-nodes-base.httpRequest': 'httprequest',
  'n8n-nodes-base.debugHelper': 'debug',
  'n8n-nodes-base.function': 'function',
  'n8n-nodes-base.wait': 'wait',
  'n8n-nodes-base.splitInBatches': 'splitInBatches',
  'n8n-nodes-base.noOp': 'noOp',
  
  // Communication
  'n8n-nodes-base.slack': 'slack',
  'n8n-nodes-base.discord': 'discord',
  'n8n-nodes-base.telegram': 'telegram',
  'n8n-nodes-base.gmail': 'gmail',
  'n8n-nodes-base.sendEmail': 'email',
  'n8n-nodes-base.microsoftTeams': 'microsoftTeams',
  'n8n-nodes-base.whatsapp': 'whatsapp',
  
  // Data
  'n8n-nodes-base.googleSheets': 'googleSheets',
  'n8n-nodes-base.airtable': 'airtable',
  'n8n-nodes-base.notion': 'notion',
  
  // Database
  'n8n-nodes-base.postgres': 'postgres',
  'n8n-nodes-base.mysql': 'mySql',
  'n8n-nodes-base.mySql': 'mySql',
  'n8n-nodes-base.mongodb': 'mongoDb',
  'n8n-nodes-base.redis': 'redis',
  
  // AI
  'n8n-nodes-base.openAi': 'openAi',
  'n8n-nodes-base.anthropic': 'anthropic',
  
  // Cloud
  'n8n-nodes-base.awsS3': 'awsS3',
  'n8n-nodes-base.googleDrive': 'googleDrive',
  'n8n-nodes-base.dropbox': 'dropbox',
  
  // CRM
  'n8n-nodes-base.hubspot': 'hubspot',
  'n8n-nodes-base.salesforce': 'salesforce',
  
  // Dev
  'n8n-nodes-base.github': 'github',
  'n8n-nodes-base.gitlab': 'gitlab',
  'n8n-nodes-base.jira': 'jira',
  
  // Transform
  'n8n-nodes-base.html': 'html',
  'n8n-nodes-base.htmlExtract': 'htmlExtract',
  'n8n-nodes-base.xml': 'xml',
  'n8n-nodes-base.crypto': 'crypto',
  'n8n-nodes-base.dateTime': 'dateTime',
};

// Get icon path - try mapped name, then extract from type
const iconPath = computed(() => {
  const mapped = iconMap[props.data.type];
  if (mapped) {
    return `/icons/${mapped}.svg`;
  }
  
  // Try to extract icon name from type (e.g., n8n-nodes-base.slack -> slack.svg)
  const typeName = props.data.type.replace('n8n-nodes-base.', '').toLowerCase();
  return `/icons/${typeName}.svg`;
});

// Fallback if icon fails to load
const iconError = ref(false);
const onIconError = () => {
  iconError.value = true;
};

// Fallback emoji icons
const fallbackIcon = computed(() => {
  const type = props.data.type.toLowerCase();
  if (type.includes('trigger')) return '⚡';
  if (type.includes('http') || type.includes('request')) return '🌐';
  if (type.includes('slack') || type.includes('discord')) return '💬';
  if (type.includes('mail') || type.includes('email')) return '📧';
  if (type.includes('sheet') || type.includes('data')) return '📊';
  if (type.includes('code') || type.includes('function')) return '💻';
  if (type.includes('if') || type.includes('switch')) return '🔀';
  if (type.includes('postgres') || type.includes('mysql') || type.includes('mongodb')) return '🗄️';
  return '⚙️';
});

const shortType = computed(() => 
  props.data.type.replace('n8n-nodes-base.', '')
);
</script>

<template>
  <div 
    class="n8n-node" 
    :class="{ 
      'n8n-node--trigger': isTrigger,
      'n8n-node--selected': selected 
    }"
  >
    <!-- Input handle (left side) -->
    <Handle 
      type="target" 
      :position="Position.Left" 
      class="n8n-handle"
    />
    
    <!-- Node body with icon -->
    <div class="n8n-node__body">
      <img 
        v-if="!iconError"
        :src="iconPath" 
        :alt="data.label"
        class="n8n-node__icon-img"
        @error="onIconError"
      />
      <div v-else class="n8n-node__icon-emoji">
        {{ fallbackIcon }}
      </div>
    </div>
    
    <!-- Label below node (n8n style) -->
    <div class="n8n-node__description">
      <div class="n8n-node__label">{{ data.label }}</div>
      <div class="n8n-node__subtitle">{{ shortType }}</div>
    </div>
    
    <!-- Output handle (right side) -->
    <Handle 
      type="source" 
      :position="Position.Right" 
      class="n8n-handle"
    />
  </div>
</template>

<style scoped lang="scss">
// n8n exact dimensions: 96x96 (16px grid * 6)
$node-size: 96px;
$grid-size: 16px;
$border-width: 2px;
$radius-lg: 8px;
$trigger-radius: 36px;

// n8n colors (dark theme)
$node-bg: #1f1f23;
$node-border: #4a4a52;
$node-selected-glow: rgba(90, 76, 175, 0.4);
$text-primary: #fff;
$text-secondary: #8b8fa3;

.n8n-node {
  position: relative;
  width: $node-size;
  height: $node-size;
  display: flex;
  align-items: center;
  justify-content: center;
  background: $node-bg;
  border: $border-width solid $node-border;
  border-radius: $radius-lg;
  cursor: pointer;
  transition: all 0.15s ease;
  
  // Trigger nodes have rounded left edge (n8n signature style)
  &.n8n-node--trigger {
    border-radius: $trigger-radius $radius-lg $radius-lg $trigger-radius;
  }
  
  // Selected state with glow
  &.n8n-node--selected {
    box-shadow: 0 0 0 8px $node-selected-glow;
  }
  
  &:hover {
    border-color: lighten($node-border, 15%);
  }
}

.n8n-node__body {
  display: flex;
  align-items: center;
  justify-content: center;
}

.n8n-node__icon-img {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.n8n-node__icon-emoji {
  font-size: 36px;
  line-height: 1;
}

// Label positioned below the node (n8n style)
.n8n-node__description {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 192px; // 2x node width
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: center;
  pointer-events: none;
}

.n8n-node__label {
  font-size: 14px;
  font-weight: 500;
  color: $text-primary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.n8n-node__subtitle {
  font-size: 12px;
  color: $text-secondary;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// n8n-style handles
.n8n-handle {
  width: 12px !important;
  height: 12px !important;
  background: $node-bg !important;
  border: 2px solid $node-border !important;
  border-radius: 50% !important;
  
  &:hover {
    background: #5a4caf !important;
    border-color: #5a4caf !important;
    transform: scale(1.2);
  }
}
</style>
