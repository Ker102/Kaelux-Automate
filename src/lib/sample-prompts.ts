import { randomUUID } from "crypto";
import sampleWorkflows from "@/../data/workflows/sample-workflows.json";

type RawSampleWorkflow = (typeof sampleWorkflows)[number];

export type PromptExample = {
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
};

const curatedExamples: PromptExample[] = sampleWorkflows.map(
  (workflow: RawSampleWorkflow) => {
    const industries = workflow.metadata?.industries ?? [];
    const domains = workflow.metadata?.domains ?? [];
    const channels = workflow.metadata?.channels ?? [];
    const integrations = workflow.metadata?.integrations ?? [];
    const trigger = workflow.metadata?.trigger;
    const complexity = workflow.metadata?.complexity;

    const basePrompt =
      workflow.problem ||
      workflow.description ||
      `Design an n8n workflow similar to "${workflow.title}".`;

    return {
      id: workflow.id ?? workflow.title ?? randomUUID(),
      title: workflow.title ?? "Untitled workflow",
      prompt: basePrompt.trim(),
      description:
        workflow.description ??
        "No description available. Focus on the prompt for guidance.",
      industries,
      domains,
      channels,
      trigger,
      complexity,
      integrations,
      tags: workflow.tags ?? [],
    };
  }
);

export function getPromptExamples(limit = 10): PromptExample[] {
  return curatedExamples.slice(0, limit);
}
