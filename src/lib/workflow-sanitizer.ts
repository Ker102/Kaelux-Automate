import { randomUUID } from "crypto";

type WorkflowNode = {
  id?: string;
  name?: string;
  type?: string;
  parameters?: Record<string, unknown>;
  [key: string]: unknown;
};

type WorkflowLike = {
  nodes?: WorkflowNode[];
  connections?: unknown;
  [key: string]: unknown;
};

type LegacyIfCondition = {
  id?: string;
  value?: unknown;
};

const DEFAULT_IF_CONDITION_OPTIONS = {
  caseSensitive: true,
  leftValue: "",
  typeValidation: "strict" as const,
  version: 2,
};

const BOOLEAN_TRUE_OPERATOR = {
  type: "boolean",
  operation: "true",
  singleValue: true,
};

function makeConditionId() {
  if (typeof randomUUID === "function") {
    return randomUUID();
  }
  return `cond-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeIfConditions(value: unknown) {
  if (!Array.isArray(value)) {
    return value;
  }

  const conditions = value
    .map((entry) => {
      const expression =
        typeof (entry as LegacyIfCondition)?.value === "string"
          ? (entry as LegacyIfCondition).value
          : "";
      if (!expression) {
        return null;
      }

      return {
        id: (entry as LegacyIfCondition).id ?? makeConditionId(),
        leftValue: expression,
        rightValue: "",
        operator: { ...BOOLEAN_TRUE_OPERATOR },
      };
    })
    .filter(Boolean);

  if (conditions.length === 0) {
    return undefined;
  }

  return {
    options: { ...DEFAULT_IF_CONDITION_OPTIONS },
    combinator: "and",
    conditions,
  };
}

function sanitizeNode(node: WorkflowNode): WorkflowNode {
  if (!node || typeof node !== "object") {
    return node;
  }

  if (!node.parameters || typeof node.parameters !== "object") {
    return node;
  }

  if (
    node.type === "n8n-nodes-base.if" &&
    "conditions" in node.parameters &&
    node.parameters.conditions &&
    typeof node.parameters.conditions === "object" &&
    Array.isArray(
      (node.parameters.conditions as { value?: unknown }).value as unknown[]
    )
  ) {
    const legacy = (node.parameters.conditions as { value?: unknown }).value;
    const normalized = normalizeIfConditions(legacy);
    if (normalized) {
      node.parameters = {
        ...node.parameters,
        conditions: normalized,
      };
    }
  }

  return node;
}

export function sanitizeWorkflowPayload(
  workflow: unknown
): WorkflowLike | undefined {
  if (!workflow || typeof workflow !== "object") {
    return undefined;
  }

  const copy: WorkflowLike = { ...(workflow as WorkflowLike) };
  if (Array.isArray(copy.nodes)) {
    copy.nodes = copy.nodes.map((node) => sanitizeNode({ ...(node ?? {}) }));
  }

  return copy;
}
