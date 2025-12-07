<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nButton, N8nCallout, N8nText, N8nIcon } from '@n8n/design-system';
import { AI_WORKFLOW_ENDPOINT } from '@/app/constants';
import { useCanvasOperations } from '@/app/composables/useCanvasOperations';
import { useWorkflowsStore } from '@/app/stores/workflows.store';
import { useToast } from '@/app/composables/useToast';
import { mapLegacyConnectionToCanvasConnection } from '@/features/workflows/canvas/canvas.utils';
import type { INodeUi } from '@/Interface';
import type { IConnection, INodeParameters, NodeConnectionType } from 'n8n-workflow';
import type { WorkflowDataUpdate } from '@n8n/rest-api-client/api/workflows';

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
	replacesWorkflow: boolean;
	actions: WorkflowAction[];
}

interface WorkflowAction {
	type:
		| 'replace_workflow'
		| 'add_node'
		| 'remove_node'
		| 'update_node'
		| 'reconnect_nodes'
		| 'custom';
	summary: string;
	targetNode?: string;
	details?: Record<string, unknown>;
	metadata?: Record<string, unknown>;
}

const locale = useI18n();
const prompt = ref('');
const isGenerating = ref(false);
const errorMessage = ref<string | null>(null);
const suggestions = ref<WorkflowSuggestion[]>([]);
const endpoint = AI_WORKFLOW_ENDPOINT;
const modelMode = ref<'fast' | 'thinking' | 'thinking-pro'>('fast');






const { importWorkflowData, deleteNodes, replaceNodeParameters, createConnection } =
	useCanvasOperations();
const toast = useToast();
const workflowsStore = useWorkflowsStore();
const expandedJsonIds = ref<Record<string, boolean>>({});
const copyFeedback = ref<string | null>(null);
let copyTimer: ReturnType<typeof setTimeout> | undefined;

const STORAGE_KEY = 'ai-workflow-builder:suggestions';
const STORAGE_LIMIT = 8;
const JSON_FEEDBACK_DURATION = 3000;
const SUPPORTED_PATCH_ACTIONS = new Set<WorkflowAction['type']>([
	'update_node',
	'remove_node',
	'add_node',
	'reconnect_nodes',
]);
const IF_CONDITION_DEFAULTS = {
	caseSensitive: true,
	leftValue: '',
	typeValidation: 'strict' as const,
	version: 2,
};
const BOOLEAN_TRUE_OPERATOR = {
	type: 'boolean',
	operation: 'true',
	singleValue: true,
};
type NormalizedIfCondition = {
	id: string;
	leftValue: string;
	rightValue: string;
	operator: typeof BOOLEAN_TRUE_OPERATOR;
};

function isSuggestionUnparsed(value?: WorkflowSuggestion | null) {
	return value?.summary === 'AI response (unparsed)';
}

function makeConditionId() {
	if (typeof globalThis.crypto?.randomUUID === 'function') {
		return globalThis.crypto.randomUUID();
	}
	return `cond-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeLegacyIfConditions(value: unknown) {
	if (!Array.isArray(value)) return undefined;

	const conditions = value
		.map((entry) => {
			const expression =
				typeof (entry as { value?: unknown }).value === 'string'
					? ((entry as { value?: string }).value as string)
					: '';
			if (!expression) return null;
			return {
				id: (entry as { id?: string }).id ?? makeConditionId(),
				leftValue: expression,
				rightValue: '',
				operator: { ...BOOLEAN_TRUE_OPERATOR },
			};
		})
		.filter((item): item is NormalizedIfCondition => Boolean(item));

	if (conditions.length === 0) return undefined;

	return {
		options: { ...IF_CONDITION_DEFAULTS },
		combinator: 'and',
		conditions,
	};
}

function sanitizeWorkflowPayload(value: unknown): WorkflowDataUpdate {
	if (!value || typeof value !== 'object') {
		return { nodes: [], connections: {} };
	}

	const workflow = value as WorkflowDataUpdate;
	const nodes = Array.isArray(workflow.nodes)
		? (workflow.nodes.map((node) => {
				if (!node || typeof node !== 'object') return node;
				if (node.type !== 'n8n-nodes-base.if') return node;
				const params =
					node.parameters && typeof node.parameters === 'object'
						? (node.parameters as Record<string, unknown>)
						: null;
				if (!params) return node;
				const legacy = (params.conditions as { value?: unknown })?.value;
				const normalized = legacy ? normalizeLegacyIfConditions(legacy) : undefined;
				if (!normalized) return node;
				return {
					...node,
					parameters: {
						...node.parameters,
						conditions: normalized,
					},
				};
		  }) as WorkflowDataUpdate['nodes'])
		: workflow.nodes;

	return {
		...workflow,
		nodes,
	};
}

function getWorkflowNodeParameters(
	workflow: WorkflowDataUpdate,
	nodeName?: string,
): INodeParameters | null {
	if (!nodeName) return null;
	const node = (workflow.nodes ?? []).find((candidate) => candidate.name === nodeName);
	if (!node || !node.parameters || typeof node.parameters !== 'object') {
		return null;
	}

	return node.parameters as INodeParameters;
}

function getWorkflowNodeDefinition(
	workflow: WorkflowDataUpdate,
	nodeName?: string,
): NonNullable<WorkflowDataUpdate['nodes']>[number] | null {
	if (!nodeName) return null;
	const nodes = (workflow.nodes ?? []) as NonNullable<WorkflowDataUpdate['nodes']>;
	const node = nodes.find((candidate) => candidate.name === nodeName);
	if (!node) return null;
	return JSON.parse(JSON.stringify(node));
}

type ConnectionTuple = {
	source: string;
	target: string;
	type: NodeConnectionType;
	sourceIndex: number;
	targetIndex: number;
};

function collectConnectionsForNode(workflow: WorkflowDataUpdate, nodeName: string): ConnectionTuple[] {
	const tuples: ConnectionTuple[] = [];
	const connections = workflow.connections ?? {};

	Object.entries(connections).forEach(([sourceName, connectionByType]) => {
		if (!connectionByType) return;
		Object.entries(connectionByType).forEach(([typeKey, outputs]) => {
			if (!Array.isArray(outputs)) return;
			outputs.forEach((branch, outputIndex) => {
				if (!Array.isArray(branch)) return;
				branch.forEach((conn) => {
					if (!conn || typeof conn !== 'object') return;
					const targetName = (conn as { node?: string }).node;
					if (!targetName) return;
					const connectionType =
						((conn as { type?: NodeConnectionType }).type ??
							(typeKey as NodeConnectionType)) || 'main';
					const targetIndex =
						typeof (conn as { index?: number }).index === 'number'
							? ((conn as { index?: number }).index as number)
							: 0;

					if (sourceName === nodeName || targetName === nodeName) {
						tuples.push({
							source: sourceName,
							target: targetName,
							type: connectionType,
							sourceIndex: outputIndex,
							targetIndex,
						});
					}
				});
			});
		});
	});

	return tuples;
}

function applyConnectionsForNode(
	nodeName: string,
	workflow: WorkflowDataUpdate,
	seenKeys: Set<string>,
) {
	const tuples = collectConnectionsForNode(workflow, nodeName);
	tuples.forEach((tuple) => {
		const key = `${tuple.source}|${tuple.target}|${tuple.type}|${tuple.sourceIndex}|${tuple.targetIndex}`;
		if (seenKeys.has(key)) {
			return;
		}

		const sourceNode = workflowsStore.getNodeByName(tuple.source);
		const targetNode = workflowsStore.getNodeByName(tuple.target);
		if (!sourceNode || !targetNode) {
			return;
		}

		const legacyConnection: [IConnection, IConnection] = [
			{
				node: sourceNode.name,
				type: tuple.type,
				index: tuple.sourceIndex,
			},
			{
				node: targetNode.name,
				type: tuple.type,
				index: tuple.targetIndex,
			},
		];

		const canvasConnection = mapLegacyConnectionToCanvasConnection(
			sourceNode,
			targetNode,
			legacyConnection,
		);
		createConnection(canvasConnection, { trackHistory: true });
		seenKeys.add(key);
	});
}

function extractActionNodes(action: WorkflowAction): string[] {
	const list: string[] = [];
	if (action.targetNode) {
		list.push(action.targetNode);
	}
	const detailNodes = action.details?.nodes;
	if (Array.isArray(detailNodes)) {
		detailNodes.forEach((node) => {
			if (typeof node === 'string' && node.trim()) {
				list.push(node.trim());
			}
		});
	}
	return Array.from(new Set(list));
}

function sanitizeActions(value: unknown): WorkflowAction[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((entry) => {
			if (!entry || typeof entry !== 'object') {
				return null;
			}

			const raw = entry as Record<string, unknown>;
			const summary =
				typeof raw.summary === 'string' && raw.summary.trim().length > 0
					? raw.summary.trim()
					: null;
			if (!summary) return null;

			const type =
				typeof raw.type === 'string'
					? (raw.type as WorkflowAction['type'])
					: 'custom';

			return {
				type,
				summary,
				...(typeof raw.targetNode === 'string' && { targetNode: raw.targetNode }),
				...(raw.details && typeof raw.details === 'object' && !Array.isArray(raw.details)
					? { details: raw.details as Record<string, unknown> }
					: {}),
				...(raw.metadata &&
				typeof raw.metadata === 'object' &&
				!Array.isArray(raw.metadata)
					? { metadata: raw.metadata as Record<string, unknown> }
					: {}),
			};
		})
		.filter((action): action is WorkflowAction => Boolean(action));
}

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
				suggestions.value = parsed.map((entry) => normalizeSuggestion(entry));
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

function normalizeSuggestion(raw: Partial<WorkflowSuggestion>): WorkflowSuggestion {
	const workflowPayload = sanitizeWorkflowPayload(raw.workflow ?? {});
	const actions = sanitizeActions((raw as { actions?: unknown }).actions);

	return {
		id: typeof raw.id === 'string' ? raw.id : makeSuggestionId(),
		prompt: typeof raw.prompt === 'string' ? raw.prompt : '',
		summary: typeof raw.summary === 'string' ? raw.summary : locale.baseText('logs.aiPanel.defaultSummary'),
		workflow: workflowPayload,
		workflowJson:
			typeof raw.workflowJson === 'string'
				? raw.workflowJson
				: JSON.stringify(workflowPayload, null, 2),
		notes: Array.isArray(raw.notes) ? raw.notes : [],
		rawText: typeof raw.rawText === 'string' ? raw.rawText : '',
		createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
		steps: Array.isArray(raw.steps) ? raw.steps : [],
		disconnectedNodes: Array.isArray(raw.disconnectedNodes) ? raw.disconnectedNodes : [],
		replacesWorkflow: Boolean(raw.replacesWorkflow),
		actions,
	};
}

const emit = defineEmits<{
	generate: [string];
	insert: [WorkflowSuggestion];
}>();

const latestSuggestion = computed(() => suggestions.value[0] ?? null);
const hasExistingWorkflow = computed(
	() => Array.isArray(workflowsStore.workflow?.nodes) && workflowsStore.workflow.nodes.length > 0,
);
const copiedSuggestionId = ref<string | null>(null);

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
			payload: {
				role: 'user',
				type: 'message',
				text: request,
				workflowContext: activeWorkflowSnapshot.value,
			},
			modelMode: modelMode.value,
		}),
	});

	const payload = (await response.json().catch(() => ({}))) as {
		suggestion?: {
			summary?: string;
			workflow?: WorkflowDataUpdate | unknown;
			notes?: string[];
			rawText?: string;
			actions?: unknown;
		};
		error?: string;
	};

	if (!response.ok || !payload.suggestion) {
		throw new Error(payload.error ?? locale.baseText('logs.aiPanel.error.generic'));
	}

	const workflowPayload = sanitizeWorkflowPayload(payload.suggestion.workflow ?? {});
	const disconnectedNodes = isWorkflowPayload(workflowPayload)
		? findDisconnectedNodes(workflowPayload)
		: [];
	const steps = describeWorkflowSteps(workflowPayload ?? {});
	const replacesWorkflow = Boolean(activeWorkflowSnapshot.value?.nodes?.length);

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
		replacesWorkflow,
		actions: sanitizeActions(payload.suggestion.actions),
	};

	suggestions.value.unshift(suggestion);
	suggestions.value = suggestions.value.slice(0, STORAGE_LIMIT);
	delete expandedJsonIds.value[suggestion.id];
	emit('generate', request);
}

async function applyWorkflowActions(
	actions: WorkflowAction[],
	workflowPayload: WorkflowDataUpdate,
): Promise<{ applied: boolean; errors: string[] }> {
	const errors: string[] = [];
	let applied = false;

	const workflow = workflowsStore.workflow;
	if (!workflow?.nodes?.length) {
		return { applied: false, errors: ['No active workflow to modify.'] };
	}

	for (const action of actions) {
		if (!SUPPORTED_PATCH_ACTIONS.has(action.type)) {
			return {
				applied: false,
				errors: [`Action "${action.type}" is not supported for partial apply.`],
			};
		}

		switch (action.type) {
			case 'remove_node': {
				if (!action.targetNode) {
					errors.push('Remove action missing target node.');
					continue;
				}
				const node = workflowsStore.getNodeByName(action.targetNode);
				if (!node?.id) {
					errors.push(`Node "${action.targetNode}" not found in the current workflow.`);
					continue;
				}
				deleteNodes([node.id], { trackHistory: true, trackBulk: true });
				applied = true;
				break;
			}
			case 'update_node': {
				if (!action.targetNode) {
					errors.push('Update action missing target node.');
					continue;
				}
				const node = workflowsStore.getNodeByName(action.targetNode);
				if (!node?.id) {
					errors.push(`Node "${action.targetNode}" not found in the current workflow.`);
					continue;
				}
				const newParameters =
					(action.details?.parameters as INodeParameters | undefined) ??
					getWorkflowNodeParameters(workflowPayload, action.targetNode);
				if (!newParameters) {
					errors.push(`No parameters supplied for node "${action.targetNode}".`);
					continue;
				}
				replaceNodeParameters(
					node.id,
					(node.parameters ?? {}) as INodeParameters,
					newParameters,
					{ trackHistory: true, trackBulk: true },
				);
				applied = true;
				break;
			}
			case 'add_node': {
				if (!action.targetNode) {
					errors.push('Add action missing target node.');
					continue;
				}
				if (workflowsStore.getNodeByName(action.targetNode)) {
					errors.push(`Node "${action.targetNode}" already exists.`);
					continue;
				}

				const definition = getWorkflowNodeDefinition(workflowPayload, action.targetNode);
				if (!definition) {
					errors.push(`Unable to find node "${action.targetNode}" in AI payload.`);
					continue;
				}

				try {
					await importWorkflowData(
						{
							nodes: [definition],
							connections: {},
						},
						'ai-builder',
						{
							regenerateIds: true,
							trackEvents: false,
						},
					);
					applyConnectionsForNode(action.targetNode, workflowPayload, new Set());
					applied = true;
				} catch (error) {
					errors.push(
						`Failed to add node "${action.targetNode}": ${
							error instanceof Error ? error.message : String(error)
						}`,
					);
				}
				break;
			}
			case 'reconnect_nodes': {
				const nodeNames = extractActionNodes(action);
				if (nodeNames.length === 0) {
					errors.push('Reconnect action requires at least one target node.');
					continue;
				}

				const seenKeys = new Set<string>();
				nodeNames.forEach((name) => {
					applyConnectionsForNode(name, workflowPayload, seenKeys);
				});
				applied = true;
				break;
			}
		}
	}

	return { applied, errors };
}

async function handleInsert(suggestion?: WorkflowSuggestion) {
	const target = suggestion ?? latestSuggestion.value;
	if (!target) return;

	if (target.actions.length > 0 && hasExistingWorkflow.value) {
		const { applied, errors } = await applyWorkflowActions(target.actions, target.workflow as WorkflowDataUpdate);
		if (errors.length > 0) {
			toast.showToast({
				title: 'Partial update issues',
				message: errors.join('\n'),
				type: 'warning',
			});
		} else if (applied) {
			toast.showToast({
				title: 'Workflow updated',
				message: 'AI suggestions applied successfully.',
				type: 'success',
			});
		}
		emit('insert', target);
		return;
	}

	const workflowData = target.workflow as WorkflowDataUpdate;
	await importWorkflowData(workflowData, 'ai-builder', {
		regenerateIds: true,
	});
	emit('insert', target);
}

function findDisconnectedNodes(workflow: WorkflowDataUpdate): string[] {
	if (!workflow.nodes) return [];
	const nodeNames = new Set(workflow.nodes.map((n) => n.name));
	const connected = new Set<string>();

	if (workflow.connections) {
		Object.values(workflow.connections).forEach((conns) => {
			Object.values(conns).forEach((outputs) => {
				outputs.forEach((branch) => {
					if (branch && Array.isArray(branch)) {
						branch.forEach((conn) => {
							if (conn && conn.node) connected.add(conn.node);
						});
					}
				});
			});
		});
		Object.keys(workflow.connections).forEach((source) => connected.add(source));
	}

	return Array.from(nodeNames).filter((name) => !connected.has(name));
}

function describeWorkflowSteps(workflow: WorkflowDataUpdate): string[] {
	if (!workflow.nodes) return [];
	return workflow.nodes.map((n) => `${n.name} (${n.type})`);
}

function toggleJsonVisibility(id: string) {
	expandedJsonIds.value[id] = !expandedJsonIds.value[id];
}

function isJsonExpanded(id: string) {
	return Boolean(expandedJsonIds.value[id]);
}

async function copyJson(text: string, id: string) {
	try {
		await navigator.clipboard.writeText(text);
		copiedSuggestionId.value = id;
		copyFeedback.value = 'Copied!';
		if (copyTimer) clearTimeout(copyTimer);
		copyTimer = setTimeout(() => {
			copyFeedback.value = null;
			copiedSuggestionId.value = null;
		}, JSON_FEEDBACK_DURATION);
	} catch (err) {
		copyFeedback.value = 'Failed to copy';
	}
}

function setPrompt(newPrompt: string) {
	prompt.value = newPrompt;
}



defineExpose({
	setPrompt,
});
</script>

<template>
	<div :class="$style.container">
		<div :class="$style.workspace">
			<div :class="$style.chatShell">
				<div :class="$style.chatStream">
					<div v-if="suggestions.length === 0" :class="$style.emptyState">
						<N8nIcon icon="sparkles" size="xlarge" color="primary" />
						<N8nText size="large" :bold="true" color="text-dark">
							Kaelux-Agent
						</N8nText>
						<N8nText color="text-base">
							What would you like to automate today?
						</N8nText>
					</div>
					<section v-else :class="$style.exchange" v-for="suggestion in suggestions" :key="suggestion.id">
						<div :class="[$style.message, $style.userMessage]">
							<div :class="$style.messageMeta">
								<span>You</span>
								<span>{{ new Date(suggestion.createdAt).toLocaleTimeString() }}</span>
							</div>
							<p>{{ suggestion.prompt }}</p>
						</div>
						<div :class="[$style.message, $style.aiMessage]">
							<div :class="$style.messageMeta">
								<span>Kaelux-Agent</span>
								<span v-if="suggestion.replacesWorkflow">Replaces Workflow</span>
								<span v-else>Updates Workflow</span>
							</div>
							<p :class="$style.aiSummary">{{ suggestion.summary }}</p>
							
							<div v-if="suggestion.actions.length > 0" :class="$style.aiGrid">
								<div v-for="(action, idx) in suggestion.actions" :key="idx" :class="$style.aiCard">
									<div :class="$style.actionMeta">
										<N8nIcon icon="wrench" size="small" />
										<span style="text-transform: capitalize">{{ action.type.replace('_', ' ') }}</span>
									</div>
									<N8nText size="small" color="text-dark" :bold="true">
										{{ action.summary }}
									</N8nText>
									<ul v-if="action.details">
										<li v-for="(val, key) in action.details" :key="key">
											{{ key }}: {{ val }}
										</li>
									</ul>
								</div>
							</div>

							<div v-if="suggestion.disconnectedNodes.length > 0" :class="$style.aiWarning">
								<N8nText color="danger" size="small" :bold="true">
									Disconnected Nodes Warning
								</N8nText>
								<N8nText size="small" color="danger">
									The following nodes are not connected to the workflow: {{ suggestion.disconnectedNodes.join(', ') }}
								</N8nText>
							</div>

							<article :class="$style.aiActions">
								<div :class="$style.actions">
									<N8nButton
										size="small"
										type="primary"
										:disabled="isGenerating || isSuggestionUnparsed(suggestion)"
										@click="handleInsert(suggestion)"
									>
										Insert into canvas
									</N8nButton>
									<N8nButton
										size="small"
										type="secondary"
										@click="toggleJsonVisibility(suggestion.id)"
									>
										{{ isJsonExpanded(suggestion.id) ? 'Hide JSON' : 'View JSON' }}
									</N8nButton>
								</div>
								<div v-if="isJsonExpanded(suggestion.id)" :class="$style.codePreview">
									<div :class="$style.codePreviewHeader">
										<span>Workflow JSON</span>
										<div :class="$style.codePreviewActions">
											<N8nButton
												size="mini"
												type="tertiary"
												@click="copyJson(suggestion.workflowJson, suggestion.id)"
											>
												Copy JSON
											</N8nButton>
											<N8nButton
												size="mini"
												type="secondary"
												@click="toggleJsonVisibility(suggestion.id)"
											>
												Close
											</N8nButton>
										</div>
									</div>
									<pre>{{ suggestion.workflowJson }}</pre>
									<p
										v-if="copyFeedback && copiedSuggestionId === suggestion.id"
										:class="$style.copyFeedback"
									>
										{{ copyFeedback }}
									</p>
								</div>
							</article>
						</div>
					</section>
				</div>
				
				<div :class="$style.composerShell">
					<div :class="$style.composerContainer">
						<div :class="$style.composerSide">
							<div :class="$style.modelToggle">
								<button 
									:class="[$style.modelBtn, modelMode === 'thinking' ? $style.activeModel : '']"
									@click="modelMode = 'thinking'"
									title="Gemini 1.5 Pro"
								>
									Thinking
								</button>
								<button 
									:class="[$style.modelBtn, modelMode === 'fast' ? $style.activeModel : '']"
									@click="modelMode = 'fast'"
									title="Gemini 2.0 Flash"
								>
									Fast
								</button>
							</div>
						</div>
						
						<div :class="$style.composerMain">
							<div :class="$style.composerAlerts">
								<N8nCallout v-if="errorMessage" icon="triangle-alert" theme="danger">
									{{ errorMessage }}
								</N8nCallout>
							</div>
							<form :class="$style.form" @submit.prevent="handleGenerate">
								<textarea
									id="ai-workflow-prompt"
									v-model="prompt"
									:placeholder="locale.baseText('logs.aiPanel.promptPlaceholder')"
									:class="$style.textarea"
									rows="1"
									@keydown.enter.prevent="handleGenerate"
								/>
								<button 
									:class="$style.sendBtn"
									:disabled="prompt.trim().length === 0 || isGenerating"
									@click.prevent="handleGenerate"
									data-test-id="ai-generate-button"
								>
									<N8nIcon icon="arrow-up" size="medium" />
								</button>
							</form>
						</div>

						<div :class="$style.composerSide">
							<!-- Right side space for future features -->
						</div>
					</div>
					<div :class="$style.footerText">
						Kaelux-Agent can make mistakes. Please review generated workflows.
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<style lang="scss" module>
.container {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-m);
	height: 100%;
	padding: var(--spacing-l);
	background-color: #050505; // Dark background
	border-radius: 0;
	overflow: hidden;
}

.workspace {
	display: flex;
	flex: 1;
	min-height: 0;
	flex-direction: column;
}

.chatShell {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-l);
	flex: 1;
	min-height: 0;
	position: relative;
}

.chatStream {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-l);
	flex: 1;
	overflow-y: auto;
	padding-right: var(--spacing-2xs);
	padding-bottom: 220px; // Increased space for the fixed composer
}

.exchange {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-xs);
	max-width: 800px;
	margin: 0 auto;
	width: 100%;
}

.message {
	width: 100%;
	margin: 0 auto;
	border-radius: 12px;
	padding: var(--spacing-m);
	line-height: 1.6;
}

.userMessage {
	background: transparent;
	color: var(--color--text);
	border-bottom: 1px solid var(--color--foreground);
}

.aiMessage {
	background: transparent;
	display: flex;
	flex-direction: column;
	gap: var(--spacing-m);
}

.messageMeta {
	display: flex;
	justify-content: space-between;
	font-size: var(--font-size-3xs);
	letter-spacing: 0.1em;
	text-transform: uppercase;
	color: var(--color--text--tint-2);
	margin-bottom: var(--spacing-2xs);
}

.aiSummary {
	margin: 0;
	font-size: var(--font-size-base);
	color: var(--color--text);
}

.aiGrid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: var(--spacing-m);
}

.aiCard {
	border-radius: 12px;
	padding: var(--spacing-m);
	background: var(--color--background--light-2);
	border: 1px solid var(--color--foreground);
	display: flex;
	flex-direction: column;
	gap: var(--spacing-3xs);
}

.aiCard ul {
	margin: 0;
	padding-left: var(--spacing-m);
	display: flex;
	flex-direction: column;
	gap: var(--spacing-4xs);
	font-size: var(--font-size-2xs);
	color: var(--color--text);
}

.actionMeta {
	color: var(--color--text--tint-1);
	font-size: var(--font-size-3xs);
}

.aiWarning {
	border-radius: 12px;
	background: color-mix(in srgb, var(--color--danger) 18%, transparent);
	border: 1px solid var(--color--danger);
	padding: var(--spacing-m);
	display: flex;
	flex-direction: column;
	gap: var(--spacing-3xs);
}

.aiActions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing-2xs);
	align-items: center;
}

.copyFeedback {
	font-size: var(--font-size-2xs);
	color: var(--color--text--tint-1);
	margin: 0;
}

.codePreview {
	background: #05050b;
	border-radius: 12px;
	border: 1px solid var(--color--foreground);
	padding: var(--spacing-s);
	font-size: var(--font-size-xs);
	line-height: 1.4;
	max-height: 320px;
	overflow: auto;
	font-family: var(--font-family--monospace, 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace);
	width: 100%;
	margin-top: var(--spacing-m);
}

.codePreview pre {
	margin: 0;
	color: var(--color--text--shade-1);
}

.codePreviewHeader {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: var(--font-size-3xs);
	text-transform: uppercase;
	letter-spacing: 0.1em;
	color: var(--color--text--tint-2);
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	padding-bottom: var(--spacing-3xs);
}

.codePreviewActions {
	display: flex;
	gap: var(--spacing-4xs);
}

.emptyState {
	max-width: 720px;
	margin: 0 auto;
	text-align: center;
	background: transparent;
	padding: var(--spacing-l);
	display: flex;
	flex-direction: column;
	gap: var(--spacing-s);
	align-items: center;
	margin-top: var(--spacing-2xl);
}

.composerShell {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: var(--spacing-xs);
	background: linear-gradient(180deg, transparent, #050505 40%);
	padding-bottom: var(--spacing-xl); // Increased bottom padding to lift it up
	padding-top: var(--spacing-xl);
	pointer-events: none; // Let clicks pass through gradient area
}

.composerContainer {
	display: flex;
	width: 100%;
	max-width: 900px;
	align-items: flex-end;
	gap: var(--spacing-m);
	pointer-events: auto; // Re-enable clicks
	padding: 0 var(--spacing-m);
}

.composerSide {
	flex: 0 0 120px; // Fixed width for sides
	display: flex;
	justify-content: center;
	padding-bottom: 12px;
}

.composerMain {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: var(--spacing-2xs);
}

.modelToggle {
	display: flex;
	background: var(--color--background--light-2);
	border-radius: 20px;
	padding: 4px;
	border: 1px solid var(--color--foreground);
}

.modelBtn {
	background: transparent;
	border: none;
	color: var(--color--text--tint-1);
	padding: 4px 12px;
	font-size: var(--font-size-2xs);
	border-radius: 16px;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		color: var(--color--text);
	}
}

.activeModel {
	background: var(--color--background--light-3);
	color: #ffffff;
	font-weight: var(--font-weight--bold);
}

.composerAlerts {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-2xs);
}

.form {
	display: flex;
	align-items: flex-end;
	gap: var(--spacing-xs);
	background: var(--color--background--light-2);
	border-radius: 24px;
	border: 1px solid var(--color--foreground);
	padding: 8px 8px 8px 16px;
	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
	transition: border-color 0.2s ease;

	&:focus-within {
		border-color: var(--color--primary);
	}
}

.textarea {
	flex: 1;
	min-height: 24px;
	max-height: 200px;
	resize: none;
	padding: 8px 0;
	font-size: var(--font-size-base);
	border: none;
	background: transparent;
	color: var(--color--text);
	outline: none;

	&::placeholder {
		color: var(--color--text--tint-2);
	}
}

.sendBtn {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 32px;
	height: 32px;
	border-radius: 50%;
	border: none;
	background: var(--color--background--light-3);
	color: var(--color--text);
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover:not(:disabled) {
		background: #ffffff;
		color: #000000;
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
}

.footerText {
	font-size: var(--font-size-2xs);
	color: var(--color--text--tint-2);
	text-align: center;
	pointer-events: auto;
}
</style>
