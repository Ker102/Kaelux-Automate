<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nButton, N8nCallout, N8nText } from '@n8n/design-system';
import { AI_WORKFLOW_ENDPOINT, AI_SAMPLE_PROMPTS_ENDPOINT } from '@/app/constants';
import { useCanvasOperations } from '@/app/composables/useCanvasOperations';
import { useWorkflowsStore } from '@/app/stores/workflows.store';
import type { WorkflowDataUpdate, INodeUi } from '@/Interface';

interface WorkflowSuggestion {
	id: string;
	prompt: string;
	summary: string;
	workflow: WorkflowDataUpdate | unknown;
	workflowJson: string;
	notes: string[];
	rawText: string;
	createdAt: string;
	steps: string[];
	disconnectedNodes: string[];
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
const canvasOperations = useCanvasOperations();
const workflowsStore = useWorkflowsStore();
const expandedJsonIds = ref<Record<string, boolean>>({});
const copyFeedback = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | undefined;

const STORAGE_KEY = 'ai-workflow-builder:suggestions';
const STORAGE_LIMIT = 8;
const JSON_FEEDBACK_DURATION = 3000;

const activeWorkflowSnapshot = computed(() => {
	const workflow = workflowsStore.workflow;
	if (!workflow || !workflow.nodes?.length) {
		return null;
	}

	const simplifiedNodes = workflow.nodes.map((node: INodeUi) => ({
		id: node.id,
		name: node.name,
		type: node.type,
		position: node.position,
		parameters: node.parameters,
		notes: node.notes,
	}));

	return {
		id: workflow.id,
		name: workflow.name,
		nodes: simplifiedNodes,
		connections: workflow.connections ?? {},
	};
});

if (typeof window !== 'undefined') {
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			if (Array.isArray(parsed)) {
				suggestions.value = parsed;
			}
		}
	} catch (error) {
		console.warn('[AI builder] Unable to restore saved suggestions', error);
	}

	watch(
		() => suggestions.value,
		(value) => {
			try {
				window.localStorage.setItem(
					STORAGE_KEY,
					JSON.stringify(value.slice(0, STORAGE_LIMIT))
				);
			} catch (error) {
				console.warn('[AI builder] Unable to persist suggestions', error);
			}
		},
		{ deep: true }
	);
}

const emit = defineEmits<{
	generate: [string];
	insert: [WorkflowSuggestion];
}>();

const latestSuggestion = computed(() => suggestions.value[0]);
const hasHistory = computed(() => suggestions.value.length > 1);
const highlightedExample = computed(() =>
	promptExamples.value.find((example) => example.id === highlightedExampleId.value) ??
	promptExamples.value[0] ??
	null
);
const latestSteps = computed(() =>
	latestSuggestion.value ? describeWorkflowSteps(latestSuggestion.value.workflow) : []
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
	if (!value) return;

	await submitPrompt(value);
	prompt.value = '';
}

async function submitPrompt(value: string) {
	isGenerating.value = true;
	errorMessage.value = null;

	try {
		await generateSuggestion(value);
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

async function generateSuggestion(request: string) {
	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			prompt: request,
			workflowContext: activeWorkflowSnapshot.value,
		}),
	});

	const payload = (await response.json().catch(() => ({}))) as {
		suggestion?: {
			summary?: string;
			workflow?: WorkflowDataUpdate | unknown;
			notes?: string[];
			rawText?: string;
		};
		error?: string;
	};

	if (!response.ok || !payload.suggestion) {
		throw new Error(payload.error ?? locale.baseText('logs.aiPanel.error.generic'));
	}

	const workflowPayload = payload.suggestion.workflow;
	const disconnectedNodes = isWorkflowPayload(workflowPayload)
		? findDisconnectedNodes(workflowPayload)
		: [];
	const steps = describeWorkflowSteps(workflowPayload ?? {});

	const suggestion: WorkflowSuggestion = {
		id: makeSuggestionId(),
		prompt: request,
		summary:
			payload.suggestion.summary ?? locale.baseText('logs.aiPanel.defaultSummary'),
		workflow: workflowPayload ?? {},
		workflowJson: JSON.stringify(workflowPayload ?? {}, null, 2),
		notes: payload.suggestion.notes ?? [],
		rawText: payload.suggestion.rawText ?? '',
		createdAt: new Date().toISOString(),
		steps,
		disconnectedNodes,
	};

	suggestions.value.unshift(suggestion);
	suggestions.value = suggestions.value.slice(0, STORAGE_LIMIT);
	delete expandedJsonIds.value[suggestion.id];
	emit('generate', request);
}

async function handleInsert() {
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

		await canvasOperations.importWorkflowData(suggestion.workflow, 'ai-builder', {
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

function toggleJsonVisibility(id: string) {
	expandedJsonIds.value[id] = !expandedJsonIds.value[id];
}

function isJsonExpanded(id: string) {
	return !!expandedJsonIds.value[id];
}

async function copyJson(json: string) {
	try {
		await navigator.clipboard.writeText(json);
		copyFeedback.value = 'JSON copied to clipboard';
		if (copyTimer) {
			clearTimeout(copyTimer);
		}
		copyTimer = setTimeout(() => {
			copyFeedback.value = null;
		}, JSON_FEEDBACK_DURATION);
	} catch (error) {
		console.warn('Unable to copy JSON', error);
		copyFeedback.value = 'Unable to copy JSON';
	}
}

function findDisconnectedNodes(workflow: WorkflowDataUpdate): string[] {
	const nodes = workflow.nodes ?? [];
	if (!nodes.length) {
		return [];
	}

	const incomingCount = new Map<string, number>();
	const outgoingCount = new Map<string, number>();

	const markOutgoing = (name: string) => {
		outgoingCount.set(name, (outgoingCount.get(name) ?? 0) + 1);
	};

	const markIncoming = (name: string) => {
		incomingCount.set(name, (incomingCount.get(name) ?? 0) + 1);
	};

	const connections = workflow.connections ?? {};
	Object.entries(connections).forEach(([sourceNode, connectionByType]) => {
		Object.values(connectionByType).forEach((connectionBranches) => {
			connectionBranches.forEach((branch) => {
				branch.forEach((connection) => {
					markOutgoing(sourceNode);
					markIncoming(connection.node);
				});
			});
@@
	});

	return nodes
		.filter((node) => {
			const incoming = incomingCount.get(node.name ?? node.id ?? 'unknown') ?? 0;
			const outgoing = outgoingCount.get(node.name ?? node.id ?? 'unknown') ?? 0;
			return incoming === 0 && outgoing === 0;
		})
		.map((node) => node.name ?? node.id ?? node.type ?? 'Unnamed node');
}

async function handleRegenerateConnections(issue: WorkflowSuggestion) {
	const missing = issue.disconnectedNodes.join(', ');
	const promptWithFix = `${issue.prompt}\n\nEnsure these nodes are connected in the regenerated workflow: ${missing}. All nodes must participate in the flow.`;
	await submitPrompt(promptWithFix);
}

function describeWorkflowSteps(workflow: unknown): string[] {
	if (!isWorkflowPayload(workflow)) {
		return [];
	}

	return (workflow.nodes ?? [])
		.slice(0, 6)
		.map((node, index) => {
			const label = node.name ?? node.id ?? node.type ?? 'Node';
			return `${index + 1}. ${label} (${node.type ?? 'unknown'})`;
		});
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
				<N8nText tag="span" size="small" color="text-light">
					Loading curated prompts...
				</N8nText>
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
						:class="[$style.sampleChip, highlightedExample?.id === example.id ? $style.sampleChipActive : '']"
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

			<ul v-if="latestSteps.length" :class="$style.steps">
				<li v-for="step in latestSteps" :key="step">{{ step }}</li>
			</ul>

			<div v-if="latestSuggestion.notes.length" :class="$style.notes">
				<ul>
					<li v-for="note in latestSuggestion.notes" :key="note">{{ note }}</li>
				</ul>
			</div>

			<N8nCallout
				v-if="latestSuggestion.disconnectedNodes.length"
				icon="alert-circle"
				theme="danger"
			>
				<p>
					Some nodes are not connected: {{ latestSuggestion.disconnectedNodes.join(', ') }}
				</p>
				<N8nButton
					size="small"
					type="tertiary"
					@click="handleRegenerateConnections(latestSuggestion)"
				>
					Regenerate with all nodes connected
				</N8nButton>
			</N8nCallout>

			<div :class="$style.jsonControls">
				<N8nButton
					size="small"
					type="secondary"
					@click="toggleJsonVisibility(latestSuggestion.id)"
				>
					{{ isJsonExpanded(latestSuggestion.id) ? 'Hide JSON' : 'View JSON' }}
				</N8nButton>
				<N8nButton size="small" type="tertiary" @click="copyJson(latestSuggestion.workflowJson)">
					Copy JSON
				</N8nButton>
			</div>
			<p v-if="copyFeedback" :class="$style.copyFeedback">{{ copyFeedback }}</p>

			<div v-if="isJsonExpanded(latestSuggestion.id)" :class="$style.jsonPreview">
				<pre><code>{{ latestSuggestion.workflowJson }}</code></pre>
			</div>
		</section>

		<section v-if="hasHistory" :class="$style.history">
			<N8nText tag="p" size="small" color="text-light">
				{{ locale.baseText('logs.aiPanel.historyTitle') }}
			</N8nText>
			<ul>
				<li v-for="suggestion in suggestions.slice(1)" :key="suggestion.id">
					<strong>{{ formatTimestamp(suggestion.createdAt) }}:</strong>
					<span>{{ suggestion.summary }}</span>
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
	font-size: var(--font-size-base);
	color: var(--color--text-base);
	margin: 0;
}

.steps {
	list-style: decimal;
	margin: 0;
	padding-left: var(--spacing-m);
	color: var(--color--text-light);
	font-size: var(--font-size-2xs);
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

.jsonControls {
	display: flex;
	gap: var(--spacing-xs);
	align-items: center;
}

.copyFeedback {
	font-size: var(--font-size-2xs);
	color: var(--color--text-light);
	margin: 0;
}

.jsonPreview {
	flex: 1;
	background-color: var(--color--background--dark);
	border-radius: var(--border-radius-base);
	padding: var(--spacing-xs);
	border: 1px solid var(--color--foreground-dark);
	overflow: auto;

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
