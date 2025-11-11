<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nButton, N8nCallout, N8nText } from '@n8n/design-system';
import { AI_WORKFLOW_ENDPOINT, AI_SAMPLE_PROMPTS_ENDPOINT } from '@/app/constants';
import { useCanvasOperations } from '@/app/composables/useCanvasOperations';
import { useWorkflowsStore } from '@/app/stores/workflows.store';
import { useWorkflowHelpers } from '@/app/composables/useWorkflowHelpers';
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
const { importWorkflowData, deleteNodes, replaceNodeParameters, deleteConnectionsByNodeId, createConnection } =
	useCanvasOperations();
const workflowHelpers = useWorkflowHelpers();
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
const hasHistory = computed(() => suggestions.value.length > 1);
const highlightedExample = computed(() =>
	promptExamples.value.find((example) => example.id === highlightedExampleId.value) ??
	promptExamples.value[0] ??
	null
);
const latestSteps = computed(() => latestSuggestion.value?.steps ?? []);
const hasExistingWorkflow = computed(
	() => Array.isArray(workflowsStore.workflow?.nodes) && workflowsStore.workflow.nodes.length > 0,
);
const latestDisconnectedNodes = computed(() => latestSuggestion.value?.disconnectedNodes ?? []);
const hasDisconnectedNodes = computed(() => latestDisconnectedNodes.value.length > 0);
const latestActions = computed(() => latestSuggestion.value?.actions ?? []);
const hasActions = computed(() => latestActions.value.length > 0);

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
				for (const nodeName of nodeNames) {
					const node = workflowsStore.getNodeByName(nodeName);
					if (!node?.id) {
						errors.push(`Cannot reconnect node "${nodeName}" because it does not exist.`);
						continue;
					}

					deleteConnectionsByNodeId(node.id, { trackHistory: true, trackBulk: true });
					applyConnectionsForNode(nodeName, workflowPayload, seenKeys);
				}

				applied = true;
				break;
			}
		}
	}

	return { applied, errors };
}

async function handleInsert() {
	const suggestion = latestSuggestion.value;

	if (!suggestion) {
		return;
	}

	const workflowPayload = sanitizeWorkflowPayload(suggestion.workflow);

	if (!isWorkflowPayload(workflowPayload)) {
		errorMessage.value = locale.baseText('logs.aiPanel.error.invalidWorkflow');
		return;
	}

	const hasReplaceAction = suggestion.actions.some((action) => action.type === 'replace_workflow');
	const shouldReplaceExisting =
		(hasExistingWorkflow.value && suggestion.replacesWorkflow) || hasReplaceAction;
	let rollbackSnapshot: WorkflowDataUpdate | null = null;

	if (shouldReplaceExisting) {
		try {
			rollbackSnapshot = await workflowHelpers.getWorkflowDataToSave();
			const nodeIdsToDelete = (workflowsStore.workflow?.nodes ?? [])
				.map((node) => node.id)
				.filter((id): id is string => typeof id === 'string');

			if (nodeIdsToDelete.length) {
				deleteNodes(nodeIdsToDelete, { trackHistory: false, trackBulk: true });
			}
		} catch (error) {
			console.warn('[AI builder] Unable to snapshot workflow before replace', error);
		}
	}

	const patchableActions = suggestion.actions.filter((action) =>
		SUPPORTED_PATCH_ACTIONS.has(action.type),
	);
	const canApplyPatch =
		!shouldReplaceExisting &&
		suggestion.actions.length > 0 &&
		patchableActions.length === suggestion.actions.length;

	if (canApplyPatch) {
		const result = await applyWorkflowActions(patchableActions, workflowPayload);
		if (result.applied) {
			toast.showToast({
				title: locale.baseText('logs.aiPanel.toast.title'),
				message: 'Applied AI-suggested changes.',
				type: 'success',
			});
			emit('insert', suggestion);
			return;
		}

		if (result.errors.length) {
			errorMessage.value = result.errors.join(' ');
		}
	}

	try {
		const nodeCount = Array.isArray(workflowPayload.nodes)
			? workflowPayload.nodes.length
			: 0;

		await importWorkflowData(workflowPayload, 'ai-builder', {
			regenerateIds: true,
			trackEvents: false,
		});

		toast.showToast({
			title: locale.baseText('logs.aiPanel.toast.title'),
			message: locale.baseText('logs.aiPanel.toast.message', {
				interpolate: { count: nodeCount },
			}),
			type: 'success',
		});
		emit('insert', suggestion);
	} catch (error) {
		if (shouldReplaceExisting && rollbackSnapshot) {
			try {
				await importWorkflowData(rollbackSnapshot, 'ai-rollback', {
					regenerateIds: false,
					trackEvents: false,
					trackHistory: false,
					importTags: false,
				});
			} catch (restoreError) {
				console.error('[AI builder] Unable to restore workflow after failed insert', restoreError);
			}
		}

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
		copyFeedback.value = locale.baseText('logs.aiPanel.copyJsonSuccess');
		if (copyTimer) {
			clearTimeout(copyTimer);
		}
		copyTimer = setTimeout(() => {
			copyFeedback.value = null;
		}, JSON_FEEDBACK_DURATION);
	} catch (error) {
		console.warn('Unable to copy JSON', error);
		copyFeedback.value = locale.baseText('logs.aiPanel.copyJsonError');
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

	const connections = (workflow.connections ?? {}) as Record<
		string,
		Record<string, Array<Array<{ node?: string }>> | undefined> | undefined
	>;

	Object.entries(connections).forEach(([sourceNode, connectionByType]) => {
		if (!connectionByType) return;

		Object.values(connectionByType).forEach((connectionBranches) => {
			if (!Array.isArray(connectionBranches)) return;

			connectionBranches.forEach((branch) => {
				if (!Array.isArray(branch)) return;

				branch.forEach((connection) => {
					const targetNode = connection?.node;
					if (!targetNode) return;

					markOutgoing(sourceNode);
					markIncoming(targetNode);
				});
			});
		});
	});

	return nodes
		.filter((node) => {
			const incoming = incomingCount.get(node.name ?? node.id ?? 'unknown') ?? 0;
			const outgoing = outgoingCount.get(node.name ?? node.id ?? 'unknown') ?? 0;
			return incoming === 0 && outgoing === 0;
		})
		.map((node) => node.name ?? node.id ?? node.type ?? 'Unnamed node');
}

async function handleRegenerateConnections(issue?: WorkflowSuggestion | null) {
	if (!issue) return;
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

function formatActionType(type: WorkflowAction['type']) {
	switch (type) {
		case 'replace_workflow':
			return 'Replace workflow';
		case 'add_node':
			return 'Add node';
		case 'remove_node':
			return 'Remove node';
		case 'update_node':
			return 'Update node';
		case 'reconnect_nodes':
			return 'Reconnect nodes';
		default:
			return 'Custom change';
	}
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
			<N8nCallout v-else-if="promptExamplesError" icon="triangle-alert" theme="danger">
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

		<N8nCallout v-if="errorMessage" icon="triangle-alert" theme="danger">
			{{ errorMessage }}
		</N8nCallout>

		<N8nCallout v-else icon="sparkles" theme="info">
			{{ locale.baseText('logs.aiPanel.infoCallout') }}
		</N8nCallout>

		<section v-if="latestSuggestion" :class="$style.result">
			<header>
				<div>
					<N8nText tag="p" size="medium" color="text-base" bold>
						{{ locale.baseText('logs.aiPanel.latestSuggestion') }}
					</N8nText>
					<N8nText tag="span" size="small" color="text-light">
						{{ formatTimestamp(latestSuggestion.createdAt) }}
					</N8nText>
				</div>
				<div :class="$style.resultActions">
					<N8nButton
						size="small"
						type="secondary"
						@click="toggleJsonVisibility(latestSuggestion.id)"
					>
						{{ isJsonExpanded(latestSuggestion.id) ? 'Hide JSON' : 'View JSON' }}
					</N8nButton>
					<N8nButton
						size="small"
						type="tertiary"
						@click="copyJson(latestSuggestion.workflowJson)"
					>
						Copy JSON
					</N8nButton>
				</div>
			</header>

			<div :class="$style.resultGrid">
				<div v-if="hasActions" :class="$style.resultCard">
					<N8nText tag="p" size="small" color="text-light" bold>
						Proposed changes
					</N8nText>
					<ol :class="$style.actionsList">
						<li v-for="action in latestActions" :key="`${action.type}-${action.summary}`">
							<strong>{{ formatActionType(action.type) }}</strong>
							<span>{{ action.summary }}</span>
							<small v-if="action.targetNode" :class="$style.actionMeta">
								Target: {{ action.targetNode }}
							</small>
						</li>
					</ol>
				</div>

				<div :class="$style.resultCard">
					<N8nText tag="p" size="small" color="text-light" bold>
						Summary
					</N8nText>
					<p :class="$style.summary">{{ latestSuggestion.summary }}</p>
				</div>

				<div v-if="latestSteps.length" :class="$style.resultCard">
					<N8nText tag="p" size="small" color="text-light" bold>
						Workflow blueprint
					</N8nText>
					<ol :class="$style.steps">
						<li v-for="step in latestSteps" :key="step">{{ step }}</li>
					</ol>
				</div>

				<div v-if="latestSuggestion.notes.length" :class="$style.resultCard">
					<N8nText tag="p" size="small" color="text-light" bold>
						Implementation notes
					</N8nText>
					<ul :class="$style.notesList">
						<li v-for="note in latestSuggestion.notes" :key="note">{{ note }}</li>
					</ul>
				</div>

				<div v-if="hasDisconnectedNodes" :class="$style.resultCardWarning">
					<N8nText tag="p" size="small" color="text-light" bold>
						Connection check
					</N8nText>
					<p :class="$style.warningText">
						Some nodes are not connected: {{ latestDisconnectedNodes.join(', ') }}
					</p>
					<N8nButton
						size="small"
						type="tertiary"
						@click="handleRegenerateConnections(latestSuggestion)"
					>
						Regenerate with all nodes connected
					</N8nButton>
				</div>
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
	gap: var(--spacing-s);

	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-s);
		flex-wrap: wrap;
	}
}

.resultActions {
	display: flex;
	gap: var(--spacing-2xs);
	flex-wrap: wrap;
}

.resultGrid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
	gap: var(--spacing-s);
}

.resultCard,
.resultCardWarning {
	background-color: var(--color--background--light-2);
	border-radius: var(--border-radius-base);
	border: 1px solid var(--color--foreground-dark);
	padding: var(--spacing-s);
	display: flex;
	flex-direction: column;
	gap: var(--spacing-3xs);
}

.resultCardWarning {
	border-color: var(--color-danger);
	background-color: color-mix(in srgb, var(--color-danger) 8%, var(--color--background--light-2));
}

.summary {
	font-size: var(--font-size-base);
	color: var(--color--text-base);
	margin: 0;
}

.steps {
	margin: 0;
	padding-left: var(--spacing-m);
	color: var(--color--text-base);
	font-size: var(--font-size-2xs);
	display: flex;
	flex-direction: column;
	gap: var(--spacing-4xs);
}

.notesList {
	margin: 0;
	padding-left: var(--spacing-m);
	display: flex;
	flex-direction: column;
	gap: var(--spacing-4xs);
	color: var(--color--text-base);
	font-size: var(--font-size-2xs);
}

.actionsList {
	margin: 0;
	padding-left: var(--spacing-m);
	display: flex;
	flex-direction: column;
	gap: var(--spacing-4xs);
	font-size: var(--font-size-2xs);

	li {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7xs);
	}
}

.actionMeta {
	color: var(--color--text-light);
}

.warningText {
	margin: 0;
	color: var(--color-danger);
	font-size: var(--font-size-2xs);
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
