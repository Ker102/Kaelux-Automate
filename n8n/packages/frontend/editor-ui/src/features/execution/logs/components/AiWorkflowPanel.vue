<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nButton, N8nCallout, N8nText } from '@n8n/design-system';
import { AI_WORKFLOW_ENDPOINT, AI_SAMPLE_PROMPTS_ENDPOINT } from '@/app/constants';
import { nodeViewEventBus } from '@/app/event-bus/node-view';
import type { WorkflowDataUpdate } from '@/Interface';

interface WorkflowSuggestion {
	id: string;
	prompt: string;
	summary: string;
	workflow: unknown;
	workflowJson: string;
	notes: string[];
	rawText: string;
	createdAt: string;
}

interface PromptExample {
	id: string;
	title: string;
	prompt: string;
	description: string;
	industries: string[];
	domains: string[];
	channels: string[];
	trigger?: string;
	complexity?: string;
	integrations: string[];
	tags: string[];
}

const locale = useI18n();
const prompt = ref('');
const isGenerating = ref(false);
const errorMessage = ref<string | null>(null);
const suggestions = ref<WorkflowSuggestion[]>([]);
const endpoint = AI_WORKFLOW_ENDPOINT;
const promptsEndpoint = AI_SAMPLE_PROMPTS_ENDPOINT;
const promptExamples = ref<PromptExample[]>([]);
const promptExamplesError = ref<string | null>(null);
const isLoadingPromptExamples = ref(true);
const highlightedExampleId = ref<string | null>(null);

const emit = defineEmits<{
	generate: [string];
	insert: [WorkflowSuggestion];
}>();

const latestSuggestion = computed(() => suggestions.value[0]);
const hasHistory = computed(() => suggestions.value.length > 1);
const highlightedExample = computed(() =>
	promptExamples.value.find((example) => example.id === highlightedExampleId.value) ??
	promptExamples.value[0] ??
	null,
);

onMounted(() => {
	void loadPromptExamples();
});

async function loadPromptExamples() {
	isLoadingPromptExamples.value = true;
	promptExamplesError.value = null;

	try {
		const response = await fetch(promptsEndpoint, { method: 'GET' });
		const payload = (await response.json().catch(() => ({}))) as {
			prompts?: PromptExample[];
			error?: string;
		};

		if (!response.ok || !payload.prompts) {
			throw new Error(payload.error ?? locale.baseText('logs.aiPanel.error.generic'));
		}

		promptExamples.value = payload.prompts;
		highlightedExampleId.value = payload.prompts[0]?.id ?? null;
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: locale.baseText('logs.aiPanel.error.generic');
		promptExamplesError.value = message;
	} finally {
		isLoadingPromptExamples.value = false;
	}
}

function handleUsePromptExample(example: PromptExample) {
	prompt.value = example.prompt;
	highlightedExampleId.value = example.id;
}

function handleHoverPromptExample(example: PromptExample) {
	highlightedExampleId.value = example.id;
}

function formatMeta(values?: string[]) {
	if (!values || values.length === 0) {
		return '—';
	}

	return values.join(', ');
}

function describeExampleCategory(example: PromptExample) {
	return (
		example.industries[0] ??
		example.domains[0] ??
		example.channels[0] ??
		example.tags[0] ??
		'General'
	);
}

function makeSuggestionId() {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}

	return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isWorkflowPayload(value: unknown): value is WorkflowDataUpdate {
	return typeof value === 'object' && value !== null && 'nodes' in (value as Record<string, unknown>);
}

async function handleGenerate() {
	const value = prompt.value.trim();

	if (!value) {
		return;
	}

	isGenerating.value = true;
	errorMessage.value = null;

	try {
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ prompt: value }),
		});

		const payload = (await response.json().catch(() => ({}))) as {
			suggestion?: {
				summary?: string;
				workflow?: unknown;
				notes?: string[];
				rawText?: string;
			};
			error?: string;
		};

		if (!response.ok || !payload.suggestion) {
			throw new Error(payload.error ?? locale.baseText('logs.aiPanel.error.generic'));
		}

		const suggestion: WorkflowSuggestion = {
			id: makeSuggestionId(),
			prompt: value,
			summary:
				payload.suggestion.summary ?? locale.baseText('logs.aiPanel.defaultSummary'),
			workflow: payload.suggestion.workflow ?? {},
			workflowJson: JSON.stringify(payload.suggestion.workflow ?? {}, null, 2),
			notes: payload.suggestion.notes ?? [],
			rawText: payload.suggestion.rawText ?? '',
			createdAt: new Date().toISOString(),
		};

		suggestions.value.unshift(suggestion);
		emit('generate', value);
		prompt.value = '';
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: locale.baseText('logs.aiPanel.error.generic');
		errorMessage.value = message;
	} finally {
		isGenerating.value = false;
	}
}

function handleInsert() {
	const suggestion = latestSuggestion.value;

	if (!suggestion) {
		return;
	}

	if (!isWorkflowPayload(suggestion.workflow)) {
		errorMessage.value = locale.baseText('logs.aiPanel.error.invalidWorkflow');
		return;
	}

	try {
		const nodeCount = Array.isArray(suggestion.workflow.nodes)
			? suggestion.workflow.nodes.length
			: 0;

		nodeViewEventBus.emit('importWorkflowData', {
			data: suggestion.workflow,
			tidyUp: true,
			regenerateIds: true,
			trackEvents: false,
			toast: {
				title: locale.baseText('logs.aiPanel.toast.title'),
				message: locale.baseText('logs.aiPanel.toast.message', {
					interpolate: { count: nodeCount },
				}),
			},
		});
		emit('insert', suggestion);
	} catch (error) {
		errorMessage.value =
			error instanceof Error
				? error.message
				: locale.baseText('logs.aiPanel.error.importFailed');
	}
}

function formatTimestamp(timestamp: string) {
	const date = new Date(timestamp);

	return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

	<section :class="$style.samples">
		<header>
			<N8nText tag="p" size="small" color="text-light">
				Need inspiration? Start from one of our curated workflow requests.
			</N8nText>
		</header>
		<div v-if="isLoadingPromptExamples" :class="$style.samplesLoading">
			<N8nText tag="span" size="small" color="text-light">Loading curated prompts...</N8nText>
		</div>
		<N8nCallout v-else-if="promptExamplesError" icon="alert-triangle" theme="danger">
			{{ promptExamplesError }}
		</N8nCallout>
		<template v-else>
			<div :class="$style.sampleList">
				<button
					v-for="example in promptExamples"
					:key="example.id"
					type="button"
					:class="[
						$style.sampleChip,
						highlightedExample?.id === example.id ? $style.sampleChipActive : '',
					]"
					@click="handleUsePromptExample(example)"
					@mouseenter="handleHoverPromptExample(example)"
				>
					<strong>{{ example.title }}</strong>
					<span>{{ describeExampleCategory(example) }}</span>
				</button>
			</div>
			<div v-if="highlightedExample" :class="$style.sampleDetails">
				<header>
					<N8nText tag="p" size="small" color="text-base" bold>
						{{ highlightedExample.title }}
					</N8nText>
					<N8nText tag="span" size="small" color="text-light">
						{{ formatMeta(highlightedExample.tags) }}
					</N8nText>
				</header>
				<p>{{ highlightedExample.description }}</p>
				<ul :class="$style.metaList">
					<li>
						<span>Industries</span>
						<strong>{{ formatMeta(highlightedExample.industries) }}</strong>
					</li>
					<li>
						<span>Domains</span>
						<strong>{{ formatMeta(highlightedExample.domains) }}</strong>
					</li>
					<li>
						<span>Channels</span>
						<strong>{{ formatMeta(highlightedExample.channels) }}</strong>
					</li>
					<li>
						<span>Trigger</span>
						<strong>{{ highlightedExample.trigger ?? '—' }}</strong>
					</li>
					<li>
						<span>Complexity</span>
						<strong>{{ highlightedExample.complexity ?? '—' }}</strong>
					</li>
					<li>
						<span>Integrations</span>
						<strong>{{ formatMeta(highlightedExample.integrations) }}</strong>
					</li>
				</ul>
			</div>
		</template>
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
				<N8nButton
					type="tertiary"
					size="medium"
					:disabled="!latestSuggestion || isGenerating"
					@click.prevent="handleInsert"
				>
					{{ locale.baseText('logs.aiPanel.insertButton') }}
				</N8nButton>
			</div>
		</form>

		<N8nCallout v-if="errorMessage" icon="alert-triangle" theme="danger">
			{{ errorMessage }}
		</N8nCallout>

		<N8nCallout v-else icon="sparkles" theme="info">
			{{ locale.baseText('logs.aiPanel.infoCallout') }}
		</N8nCallout>

		<section v-if="latestSuggestion" :class="$style.result">
			<header>
				<N8nText tag="p" size="medium" color="text-base" bold>
					{{ locale.baseText('logs.aiPanel.latestSuggestion') }}
				</N8nText>
				<N8nText tag="span" size="small" color="text-light">
					{{ formatTimestamp(latestSuggestion.createdAt) }}
				</N8nText>
			</header>
			<p :class="$style.summary">{{ latestSuggestion.summary }}</p>
			<div v-if="latestSuggestion.notes.length" :class="$style.notes">
				<ul>
					<li v-for="note in latestSuggestion.notes" :key="note">{{ note }}</li>
				</ul>
			</div>
			<div :class="$style.jsonPreview">
				<pre><code>{{ latestSuggestion.workflowJson }}</code></pre>
			</div>
		</section>

		<section v-if="hasHistory" :class="$style.history">
			<N8nText tag="p" size="small" color="text-light">
				{{ locale.baseText('logs.aiPanel.historyTitle') }}
			</N8nText>
			<ul>
				<li
					v-for="suggestion in suggestions.slice(1)"
					:key="suggestion.id"
				>
					<strong>{{ formatTimestamp(suggestion.createdAt) }}:</strong>
					<span>{{ suggestion.prompt }}</span>
				</li>
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
	overflow: auto;
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

.samples {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-xs);
	background-color: var(--color--background--light-2);
	border-radius: var(--border-radius-large);
	padding: var(--spacing-s);
}

.samplesLoading {
	padding: var(--spacing-2xs) var(--spacing-xs);
}

.sampleList {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing-2xs);
}

.sampleChip {
	flex: 1 1 240px;
	min-width: 200px;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: var(--spacing-5xs);
	background: var(--color--background);
	border: 1px solid var(--color--foreground-dark);
	border-radius: var(--border-radius-base);
	padding: var(--spacing-xs);
	cursor: pointer;
	transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.sampleChip:hover {
	border-color: var(--color-primary);
	box-shadow: 0 0 0 1px var(--color-primary-transparent-light);
}

.sampleChipActive {
	border-color: var(--color-primary);
	box-shadow: 0 0 0 1px var(--color-primary);
}

.sampleChip strong {
	font-size: var(--font-size-s);
}

.sampleChip span {
	font-size: var(--font-size-2xs);
	color: var(--color--text-light);
}

.sampleDetails {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-2xs);
	background-color: var(--color--background);
	border-radius: var(--border-radius-base);
	border: 1px solid var(--color--foreground-dark);
	padding: var(--spacing-s);
}

.metaList {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	gap: var(--spacing-3xs);
	list-style: none;
	margin: 0;
	padding: 0;

	li {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6xs);
	}

	span {
		font-size: var(--font-size-3xs);
		color: var(--color--text-light);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	strong {
		font-size: var(--font-size-2xs);
		color: var(--color--text-base);
	}
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

.result {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-xs);
}

.summary {
	font-size: var(--font-size-s);
	color: var(--color--text-base);
	margin: 0;
}

.notes {
	background-color: var(--color--background--light-2);
	border-radius: var(--border-radius-base);
	padding: var(--spacing-2xs) var(--spacing-xs);

	ul {
		margin: 0;
		padding-left: var(--spacing-m);
	}
}

.jsonPreview {
	flex: 1;
	background-color: var(--color--background--dark);
	border-radius: var(--border-radius-base);
	padding: var(--spacing-xs);
	overflow: auto;
	border: 1px solid var(--color--foreground-dark);

	pre {
		margin: 0;
		font-size: var(--font-size-xs);
		line-height: 1.4;
		white-space: pre-wrap;
		word-break: break-word;
	}
}

.history {
	border-top: 1px solid var(--color--foreground-dark);
	padding-top: var(--spacing-xs);

	ul {
		margin: 0;
		padding-left: var(--spacing-m);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4xs);
	}
}
</style>
