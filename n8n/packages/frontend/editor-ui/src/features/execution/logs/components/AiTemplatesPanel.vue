<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useI18n } from '@n8n/i18n';
import { N8nIcon, N8nText, N8nScrollArea } from '@n8n/design-system';
import { AI_SAMPLE_PROMPTS_ENDPOINT } from '@/app/constants';

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

const emit = defineEmits<{
	'use-template': [string];
}>();

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

		promptExamples.value = payload.prompts;
	} catch (error) {
		console.warn('Failed to load AI prompts, using defaults', error);
		// Fallback to defaults on error, do not show error message to user
		promptExamples.value = defaultTemplates;
	} finally {
		isLoadingPromptExamples.value = false;
	}
}

function handleUsePromptExample(example: PromptExample) {
	emit('use-template', example.prompt);
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
</script>

<template>
	<div :class="$style.container">
		<N8nScrollArea :class="$style.scrollRoot">
			<div :class="$style.content">
				<div v-if="isLoadingPromptExamples" :class="$style.loading">
					<N8nText>{{ locale.baseText('generic.loading') }}...</N8nText>
				</div>
				<div v-else-if="promptExamplesError" :class="$style.error">
					<N8nText color="danger">{{ promptExamplesError }}</N8nText>
				</div>
				<div v-else :class="$style.sampleGroups">
					<div
						v-for="group in groupedPromptExamples"
						:key="group.category"
						:class="$style.sampleGroup"
					>
						<div :class="$style.sampleGroupHeader">
							<N8nText size="small" color="text-light" :bold="true" style="text-transform: capitalize">
								{{ group.category }}
							</N8nText>
						</div>
						<div :class="$style.sampleCardGrid">
							<div
								v-for="example in group.items"
								:key="example.id"
								:class="[
									$style.sampleCard,
									{ [$style.sampleCardActive]: highlightedExampleId === example.id },
								]"
								@click="handleUsePromptExample(example)"
								@mouseenter="handleHoverPromptExample(example)"
								@mouseleave="highlightedExampleId = null"
							>
								<div :class="$style.sampleMetaRow">
									<span>{{ example.complexity }}</span>
									<span>{{ example.trigger }}</span>
								</div>
								<N8nText size="medium" :bold="true" color="text-dark">
									{{ example.title }}
								</N8nText>
								<p :class="$style.sampleDescription">
									{{ example.description }}
								</p>
								<div :class="$style.sampleActions">
									<div :class="$style.actionMeta">
										<N8nIcon icon="layers" size="small" />
										<span>{{ formatMeta(example.integrations) }}</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</N8nScrollArea>
	</div>
</template>

<style lang="scss" module>
.container {
	height: 100%;
	width: 100%;
	background-color: #050505; // Dark background
	padding: var(--spacing-m);
}

.scrollRoot {
	height: 100%;
}

.content {
	padding-bottom: var(--spacing-2xl);
}

.loading,
.error {
	display: flex;
	justify-content: center;
	padding: var(--spacing-xl);
}

.sampleGroups {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-l);
}

.sampleGroup {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-s);
}

.sampleGroupHeader {
	display: flex;
	flex-direction: column;
	padding-bottom: var(--spacing-2xs);
	border-bottom: 1px solid var(--color--foreground);
}

.sampleCardGrid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	gap: var(--spacing-m);
}

.sampleCard {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-xs);
	background: var(--color--background--light-1);
	border-radius: var(--border-radius-large);
	border: 1px solid var(--color--foreground);
	padding: var(--spacing-m);
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		transform: translateY(-2px);
		border-color: var(--color--primary);
		background: var(--color--background--light-2);
	}
}

.sampleCardActive {
	border-color: var(--color--primary);
}

.sampleDescription {
	font-size: var(--font-size-2xs);
	color: var(--color--text--tint-1);
	margin: 0;
	line-height: 1.5;
	display: -webkit-box;
	-webkit-line-clamp: 3;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

.sampleMetaRow {
	display: flex;
	justify-content: space-between;
	font-size: var(--font-size-3xs);
	text-transform: uppercase;
	color: var(--color--text--tint-2);
	margin-bottom: var(--spacing-2xs);
}

.sampleActions {
	margin-top: auto;
	padding-top: var(--spacing-s);
	border-top: 1px solid var(--color--foreground);
}

.actionMeta {
	display: flex;
	align-items: center;
	gap: var(--spacing-2xs);
	color: var(--color--text--tint-1);
	font-size: var(--font-size-2xs);
}
</style>
