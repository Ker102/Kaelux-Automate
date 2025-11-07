<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nButton, N8nCallout, N8nText } from '@n8n/design-system';

const locale = useI18n();

const prompt = ref('');
const ideas = ref<string[]>([]);
const isGenerating = ref(false);

const emit = defineEmits<{ generate: [string] }>();

function handleGenerate() {
	const value = prompt.value.trim();

	if (!value) {
		return;
	}

	isGenerating.value = true;
	ideas.value.unshift(value);
	emit('generate', value);
	prompt.value = '';

	// Temporary loading simulation until the real API is connected.
	setTimeout(() => {
		isGenerating.value = false;
	}, 600);
}
</script>

<template>
	<div :class="$style.container">
		<section :class="$style.header">
			<N8nText tag="p" size="medium" color="text-base" bold>
				{{ locale.baseText('logs.aiPanel.title') }}
			</N8nText>
			<N8nText tag="p" size="small" color="text-light">
				{{ locale.baseText('logs.aiPanel.subtitle') }}
			</N8nText>
		</section>

		<form :class="$style.form" @submit.prevent="handleGenerate">
			<label :class="$style.label" for="ai-workflow-prompt">
				{{ locale.baseText('logs.aiPanel.promptLabel') }}
			</label>
			<textarea
				id="ai-workflow-prompt"
				v-model="prompt"
				:placeholder="locale.baseText('logs.aiPanel.promptPlaceholder')"
				:class="$style.textarea"
				rows="4"
			/>
			<div :class="$style.actions">
				<N8nButton
					type="primary"
					size="medium"
					:loading="isGenerating"
					:disabled="prompt.trim().length === 0"
					@click="handleGenerate"
				>
					{{ locale.baseText('logs.aiPanel.generateButton') }}
				</N8nButton>
				<N8nButton type="tertiary" size="medium" :disabled="isGenerating">
					{{ locale.baseText('logs.aiPanel.insertButton') }}
				</N8nButton>
			</div>
		</form>

		<N8nCallout icon="sparkles" theme="info">
			{{ locale.baseText('logs.aiPanel.infoCallout') }}
		</N8nCallout>

		<section v-if="ideas.length > 0" :class="$style.history">
			<N8nText tag="p" size="medium" color="text-base" bold>
				{{ locale.baseText('logs.aiPanel.historyTitle') }}
			</N8nText>
			<ul>
				<li v-for="idea in ideas" :key="idea">{{ idea }}</li>
			</ul>
		</section>
	</div>
</template>

<style lang="scss" module>
.container {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-m);
	height: 100%;
	padding: var(--spacing-m);
	background-color: var(--color--foreground);
	border-radius: var(--border-radius-large);
	border: var(--border);
}

.header {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-4xs);
}

.form {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-xs);
}

.label {
	font-size: var(--font-size-xs);
	font-weight: var(--font-weight-bold);
	color: var(--color--text-base);
}

.textarea {
	width: 100%;
	resize: vertical;
	padding: var(--spacing-s);
	font-size: var(--font-size-s);
	border-radius: var(--border-radius-base);
	border: 1px solid var(--color--foreground-dark);
	background-color: var(--color--background);
	color: var(--color--text-base);
}

.textarea:focus {
	outline: none;
	border-color: var(--color-primary);
	box-shadow: 0 0 0 1px var(--color-primary);
}

.actions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing-2xs);
}

.history {
	flex: 1;
	overflow: auto;

	ul {
		margin: 0;
		padding-left: var(--spacing-m);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4xs);
	}
}
</style>
