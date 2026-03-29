export interface WorkflowConfig {
  aiTimeout: number;
  baseBranch: string;
  branchPrefix: string;
  labels: {
    ready: string;
    inProgress: string;
    inReview: string;
  };
  testCommand?: string;
  lintCommand?: string;
  workingDir: string;
}

export function createDefaultConfig(
  overrides: Partial<WorkflowConfig> = {},
): WorkflowConfig {
  return {
    aiTimeout:
      overrides.aiTimeout ??
      (process.env["AI_SCRUM_AI_TIMEOUT"]
        ? Number(process.env["AI_SCRUM_AI_TIMEOUT"])
        : 1_800_000),
    baseBranch:
      overrides.baseBranch ??
      process.env["AI_SCRUM_BASE_BRANCH"] ??
      "main",
    branchPrefix: overrides.branchPrefix ?? "task/",
    labels: overrides.labels ?? {
      ready: "ai-scrum:issue:status:ready",
      inProgress: "ai-scrum:issue:status:in-progress",
      inReview: "ai-scrum:issue:status:in-review",
    },
    testCommand:
      overrides.testCommand ?? process.env["AI_SCRUM_TEST_COMMAND"],
    lintCommand:
      overrides.lintCommand ?? process.env["AI_SCRUM_LINT_COMMAND"],
    workingDir: overrides.workingDir ?? process.cwd(),
  };
}
