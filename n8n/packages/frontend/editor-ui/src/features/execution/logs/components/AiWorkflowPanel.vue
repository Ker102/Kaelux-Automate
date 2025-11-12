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
	category?: string;
}

const locale = useI18n();
const prompt = ref('');
const isGenerating = ref(false);
const errorMessage = ref<string | null>(null);
const suggestions = ref<WorkflowSuggestion[]>([]);
const endpoint = AI_WORKFLOW_ENDPOINT;
const promptsEndpoint = AI_SAMPLE_PROMPTS_ENDPOINT;
const promptExamples = ref<PromptExample[]>([]);
const defaultTemplates: PromptExample[] = [
	{
		id: 'sales-digest',
		category: 'Sales & CRM',
		title: 'Daily Sales Follow-up Digest',
		description: 'Summarize new CRM leads, highlight stale deals, and send reminders to account owners.',
		prompt:
			"Every weekday morning summarize CRM leads added in the last 24h, list stale opportunities, and DM owners in Slack with follow-up reminders.",
		industries: ['sales'],
		domains: ['summaries'],
		channels: ['slack'],
		trigger: 'scheduled',
		complexity: 'medium',
		integrations: ['HubSpot', 'Salesforce', 'Slack'],
		tags: ['sales', 'crm'],
	},
	{
		id: 'finance-triage',
		category: 'Finance & Ops',
		title: 'Invoice Auto-Triage',
		description: 'Monitor inbox for invoices, extract totals, sync to sheets, and alert finance when thresholds are exceeded.',
		prompt:
			"Watch a finance inbox for new invoices, extract supplier, total, due date, log to Google Sheets, and alert the finance channel when totals exceed $5,000.",
		industries: ['finance'],
		domains: ['payments'],
		channels: ['slack'],
		trigger: 'email',
		complexity: 'medium',
		integrations: ['Gmail', 'Google Sheets', 'Slack'],
		tags: ['finance', 'ops'],
	},
	{
		id: 'marketing-launch',
		category: 'Marketing',
		title: 'Product Launch Amplifier',
		description: 'Repurpose a launch brief into scheduled posts across social channels with approval steps.',
		prompt:
			"Given a product brief, create social posts for LinkedIn, Twitter, and Instagram, queue them for approval, and schedule across the week.",
		industries: ['marketing'],
		domains: ['content-scheduling'],
		channels: ['linkedin', 'twitter', 'instagram'],
		trigger: 'manual',
		complexity: 'high',
		integrations: ['Notion', 'Buffer'],
		tags: ['marketing'],
	},
	{
		id: 'ops-heartbeat',
		category: 'Operations',
		title: 'Daily Ops Heartbeat',
		description: 'Collect metrics from multiple services, compile a dashboard snapshot, and email the team.',
		prompt:
			"Every morning pull key metrics (support tickets, uptime, revenue) from their APIs, render a summary, and email operations leadership.",
		industries: ['operations'],
		domains: ['reporting'],
		channels: ['email'],
		trigger: 'scheduled',
		complexity: 'medium',
		integrations: ['Zendesk', 'Postgres', 'SendGrid'],
		tags: ['ops'],
	},
	{
		id: 'support-escalation',
		category: 'Customer Support',
		title: 'Smart Escalations',
		description:
			'Listen for high-severity tickets, translate summaries, create Jira issues, and notify on-call responders.',
		prompt:
			"Monitor support tickets for severity=high, summarize them, create Jira issues, and page the on-call responder via Slack.",
		industries: ['support'],
		domains: ['ticket-routing'],
		channels: ['slack'],
		trigger: 'webhook',
		complexity: 'medium',
		integrations: ['Zendesk', 'Jira', 'Slack'],
		tags: ['support'],
	},
	{
		id: 'customer-onboarding',
		category: 'Customer Success',
		title: 'Customer Onboarding Checklist',
		description:
			'When a deal closes, generate onboarding tasks, welcome emails, and schedule the kickoff meeting automatically.',
		prompt:
			"When a CRM opportunity moves to Closed Won, kick off an onboarding checklist: create task list, send welcome email, and schedule kickoff.",
		industries: ['customer success'],
		domains: ['project-management'],
		channels: ['email'],
		trigger: 'crm-event',
		complexity: 'medium',
		integrations: ['Salesforce', 'Asana', 'Calendly'],
		tags: ['success'],
	},
];
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

const groupedPromptExamples = computed(() => {
	if (!promptExamples.value.length) return [];

	const map = new Map<string, PromptExample[]>();
	promptExamples.value.forEach((example) => {
		const category =
			example.industries[0] ??
			example.domains[0] ??
			example.channels[0] ??
			example.trigger ??
			'General';
		if (!map.has(category)) map.set(category, []);
		map.get(category)?.push(example);
	});

	return Array.from(map.entries()).map(([category, items]) => ({
		category,
		items,
	}));
});

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

		promptExamples.value = defaultTemplates;
		highlightedExampleId.value = promptExamples.value[0]?.id ?? null;
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

function handleApplyPromptExample(example: PromptExample) {
	handleUsePromptExample(example);
	void submitPrompt(example.prompt);
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

async function handleInsert(targetSuggestion?: WorkflowSuggestion | null) {
	const suggestion = targetSuggestion ?? latestSuggestion.value;

	if (!suggestion) {
		return;
	}

	const workflowPayload = sanitizeWorkflowPayload(suggestion.workflow);

	if (!isWorkflowPayload(workflowPayload)) {
		errorMessage.value = locale.baseText('logs.aiPanel.error.invalidWorkflow');
		return;
	}
	if (!Array.isArray(workflowPayload.nodes) || workflowPayload.nodes.length === 0) {
		errorMessage.value = locale.baseText('logs.aiPanel.error.emptyWorkflow');
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

async function copyJson(json: string, suggestionId?: string) {
	try {
		await navigator.clipboard.writeText(json);
		copyFeedback.value = locale.baseText('logs.aiPanel.copyJsonSuccess');
		copiedSuggestionId.value = suggestionId ?? null;
		if (copyTimer) {
			clearTimeout(copyTimer);
		}
		copyTimer = setTimeout(() => {
			copyFeedback.value = null;
			copiedSuggestionId.value = null;
		}, JSON_FEEDBACK_DURATION);
	} catch (error) {
		console.warn('Unable to copy JSON', error);
		copyFeedback.value = locale.baseText('logs.aiPanel.copyJsonError');
		copiedSuggestionId.value = suggestionId ?? null;
		if (copyTimer) {
			clearTimeout(copyTimer);
		}
		copyTimer = setTimeout(() => {
			copyFeedback.value = null;
			copiedSuggestionId.value = null;
		}, JSON_FEEDBACK_DURATION);
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
					Start from a curated template and let the assistant adapt it to your workflow.
				</N8nText>
			</header>
			<div v-if="isLoadingPromptExamples" :class="$style.samplesLoading">
				<N8nText tag="span" size="small" color="text-light">
					Loading curated templates...
				</N8nText>
			</div>
			<N8nCallout v-else-if="promptExamplesError" icon="triangle-alert" theme="danger">
				{{ promptExamplesError }}
			</N8nCallout>
			<div v-else :class="$style.sampleGroups">
				<div v-for="group in groupedPromptExamples" :key="group.category" :class="$style.sampleGroup">
					<div :class="$style.sampleGroupHeader">
						<N8nText tag="span" size="small" color="text-light">Category</N8nText>
						<N8nText tag="p" size="medium" color="text-base" bold>
							{{ group.category }}
						</N8nText>
					</div>
					<div :class="$style.sampleCardGrid">
						<div
							v-for="example in group.items"
							:key="example.id"
							:class="[$style.sampleCard, highlightedExampleId === example.id ? $style.sampleCardActive : '']"
							@click="handleUsePromptExample(example)"
							@mouseenter="handleHoverPromptExample(example)"
						>
							<div>
								<N8nText tag="p" size="small" color="text-light">
									{{ formatMeta(example.tags) }}
								</N8nText>
								<N8nText tag="p" size="medium" color="text-base" bold>
									{{ example.title }}
								</N8nText>
								<p :class="$style.sampleDescription">{{ example.description }}</p>
							</div>
							<div :class="$style.sampleMetaRow">
								<span>{{ formatMeta(example.industries) }}</span>
								<span>{{ formatMeta(example.channels) }}</span>
							</div>
							<div :class="$style.sampleActions">
								<N8nButton
									size="small"
									type="secondary"
									@click.stop="handleUsePromptExample(example)"
								>
									Fill prompt
								</N8nButton>
								<N8nButton
									size="small"
									type="tertiary"
									@click.stop="handleApplyPromptExample(example)"
								>
									Use template
								</N8nButton>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section :class="$style.chatShell">
			<div :class="$style.chatStream">
				<div v-if="suggestions.length === 0" :class="$style.emptyState">
					<N8nText tag="p" size="medium" color="text-base" bold>Start a new automation brief</N8nText>
					<p>
						Share what you need automated or pick a template above. Each prompt stays in this timeline so you can review the
						history, iterate, and insert the best response into your workflow.
					</p>
					<ul>
						<li>Describe the trigger, data sources, and desired outputs.</li>
						<li>Mention important tools or constraints to guide the assistant.</li>
						<li>Adjust and resend your prompt until the blueprint feels right.</li>
					</ul>
				</div>
				<div v-else v-for="suggestion in suggestions" :key="suggestion.id" :class="$style.exchange">
					<article :class="[$style.message, $style.userMessage]">
						<div :class="$style.messageMeta">
							<span>You</span>
							<span>{{ formatTimestamp(suggestion.createdAt) }}</span>
						</div>
						<p>{{ suggestion.prompt }}</p>
					</article>
					<article :class="[$style.message, $style.aiMessage]">
						<div :class="$style.messageMeta">
							<span>Kaelux Automate</span>
							<span>{{ formatTimestamp(suggestion.createdAt) }}</span>
						</div>
						<p :class="$style.aiSummary">{{ suggestion.summary }}</p>
						<div
							v-if="suggestion.steps.length || suggestion.notes.length || suggestion.actions.length"
							:class="$style.aiGrid"
						>
							<div v-if="suggestion.steps.length" :class="$style.aiCard">
								<N8nText tag="span" size="small" color="text-light">Workflow blueprint</N8nText>
								<ul>
									<li v-for="step in suggestion.steps" :key="step">{{ step }}</li>
								</ul>
							</div>
							<div v-if="suggestion.notes.length" :class="$style.aiCard">
								<N8nText tag="span" size="small" color="text-light">Implementation notes</N8nText>
								<ul>
									<li v-for="note in suggestion.notes" :key="note">{{ note }}</li>
								</ul>
							</div>
							<div v-if="suggestion.actions.length" :class="$style.aiCard">
								<N8nText tag="span" size="small" color="text-light">Proposed actions</N8nText>
								<ul>
									<li v-for="action in suggestion.actions" :key="`${suggestion.id}-${action.type}-${action.summary}`">
										<strong>{{ formatActionType(action.type) }}</strong>
										<span>{{ action.summary }}</span>
										<span v-if="action.targetNode" :class="$style.actionMeta">Node: {{ action.targetNode }}</span>
									</li>
								</ul>
							</div>
						</div>
						<div v-if="suggestion.disconnectedNodes.length" :class="$style.aiWarning">
							<N8nText tag="span" size="small" color="danger">Disconnected nodes</N8nText>
							<p>
								Some nodes are not connected: {{ suggestion.disconnectedNodes.join(', ') }}
							</p>
							<N8nButton size="mini" type="secondary" @click="handleRegenerateConnections(suggestion)">
								Ask AI to reconnect them
							</N8nButton>
						</div>
						<div :class="$style.aiActions">
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
							<N8nButton
								size="small"
								type="tertiary"
								@click="copyJson(suggestion.workflowJson, suggestion.id)"
							>
								Copy JSON
							</N8nButton>
							<p v-if="copyFeedback && copiedSuggestionId === suggestion.id" :class="$style.copyFeedback">
								{{ copyFeedback }}
							</p>
						</div>
						<div v-if="isJsonExpanded(suggestion.id)" :class="$style.codePreview">
							<pre>{{ suggestion.workflowJson }}</pre>
						</div>
					</article>
				</div>
			</div>
			<div :class="$style.composerShell">
				<div :class="$style.composerAlerts">
					<N8nCallout v-if="errorMessage" icon="triangle-alert" theme="danger">
						{{ errorMessage }}
					</N8nCallout>
					<N8nCallout v-else icon="sparkles" theme="info">
						{{ locale.baseText('logs.aiPanel.infoCallout') }}
					</N8nCallout>
				</div>
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
							:disabled="!latestSuggestion || isGenerating || isSuggestionUnparsed(latestSuggestion)"
							@click.prevent="handleInsert()"
						>
							{{ locale.baseText('logs.aiPanel.insertButton') }}
						</N8nButton>
					</div>
				</form>
			</div>
		</section>
	</div>
</template>

<style lang="scss" module>
.container {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-l);
	height: 100%;
	padding: var(--spacing-l);
	background-color: var(--color--background--shade-1);
	border-radius: 32px;
	border: 1px solid var(--color--foreground);
	overflow: auto;
}

.header {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-4xs);
}

.samples {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-xs);
	background: linear-gradient(135deg, rgba(12, 12, 26, 0.9), rgba(26, 26, 42, 0.85));
	border-radius: 28px;
	padding: var(--spacing-m);
	border: 1px solid var(--color--foreground);
	box-shadow: 0 30px 55px rgba(0, 0, 0, 0.4);
}

.samplesLoading {
	padding: var(--spacing-2xs) var(--spacing-xs);
}

.sampleGroups {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-s);
}

.sampleGroup {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-2xs);
}

.sampleGroupHeader {
	display: flex;
	flex-direction: column;
}

.sampleCardGrid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	gap: var(--spacing-s);
}

.sampleCard {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-xs);
	background: var(--color--background);
	border-radius: 20px;
	border: 1px solid var(--color--foreground);
	padding: var(--spacing-m);
	box-shadow: 0 18px 30px rgba(0, 0, 0, 0.35);
	cursor: pointer;
	transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.sampleCard:hover {
	transform: translateY(-3px);
	border-color: var(--color--primary);
	box-shadow: 0 25px 45px rgba(0, 0, 0, 0.45);
}

.sampleCardActive {
	border-color: var(--color--primary);
	box-shadow: 0 30px 55px rgba(255, 59, 255, 0.25);
}

.sampleDescription {
	font-size: var(--font-size-2xs);
	color: var(--color--text--tint-1);
	margin: 0;
	min-height: 48px;
}

.sampleMetaRow {
	display: flex;
	justify-content: space-between;
	font-size: var(--font-size-3xs);
	text-transform: uppercase;
	color: var(--color--text--tint-2);
	gap: var(--spacing-3xs);
}

.sampleActions {
	display: flex;
	gap: var(--spacing-2xs);
}

.chatShell {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-l);
	flex: 1;
	min-height: 0;
}

.chatStream {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-l);
	flex: 1;
	overflow-y: auto;
	padding-right: var(--spacing-2xs);
}

.exchange {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-xs);
}

.message {
	max-width: 960px;
	width: 100%;
	margin: 0 auto;
	border-radius: 32px;
	padding: var(--spacing-m);
	line-height: 1.6;
	box-shadow: 0 30px 55px rgba(0, 0, 0, 0.45);
	border: 1px solid var(--color--foreground);
}

.userMessage {
	background: var(--color--background--light-2);
	color: var(--color--text);
}

.userMessage p {
	margin: 0;
	font-size: var(--font-size-base);
}

.aiMessage {
	background: var(--color--background);
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
	border-radius: 22px;
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
	border-radius: 22px;
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
	border-radius: 20px;
	border: 1px solid var(--color--foreground);
	padding: var(--spacing-s);
	font-size: var(--font-size-xs);
	line-height: 1.4;
	max-height: 320px;
	overflow: auto;
}

.codePreview pre {
	margin: 0;
}

.emptyState {
	max-width: 720px;
	margin: 0 auto;
	text-align: center;
	background: var(--color--background--light-2);
	border-radius: 28px;
	border: 1px dashed var(--color--foreground);
	padding: var(--spacing-l);
	display: flex;
	flex-direction: column;
	gap: var(--spacing-s);
	box-shadow: 0 20px 35px rgba(0, 0, 0, 0.35);
}

.emptyState ul {
	margin: 0;
	padding-left: var(--spacing-l);
	text-align: left;
	display: flex;
	flex-direction: column;
	gap: var(--spacing-4xs);
	color: var(--color--text);
}

.composerShell {
	position: sticky;
	bottom: 0;
	display: flex;
	flex-direction: column;
	gap: var(--spacing-s);
	background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.55));
	padding-bottom: var(--spacing-xs);
}

.composerAlerts {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-2xs);
}

.form {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-xs);
	background: var(--color--background);
	border-radius: 30px;
	border: 1px solid var(--color--foreground);
	box-shadow: 0 35px 65px rgba(0, 0, 0, 0.55);
	padding: var(--spacing-m);
}

.label {
	font-size: var(--font-size-xs);
	color: var(--color--text--tint-1);
	text-transform: uppercase;
	letter-spacing: 0.1em;
}

.textarea {
	width: 100%;
	min-height: 120px;
	resize: none;
	padding: var(--spacing-m);
	font-size: var(--font-size-base);
	border-radius: 22px;
	border: 1px solid var(--color--foreground);
	background-color: var(--color--background--shade-1);
	color: var(--color--text);
}

.actions {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing-2xs);
	justify-content: flex-end;
}
</style>

