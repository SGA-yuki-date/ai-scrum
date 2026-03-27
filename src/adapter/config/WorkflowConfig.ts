export interface WorkflowConfig {
  aiTimeout: number;
  baseBranch: string;
  branchPrefix: string;
  labels: {
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
        : 600_000),
    baseBranch:
      overrides.baseBranch ??
      process.env["AI_SCRUM_BASE_BRANCH"] ??
      "main",
    branchPrefix: overrides.branchPrefix ?? "task/",
    labels: overrides.labels ?? {
      inProgress: "status:in-progress",
      inReview: "status:in-review",
    },
    testCommand:
      overrides.testCommand ?? process.env["AI_SCRUM_TEST_COMMAND"],
    lintCommand:
      overrides.lintCommand ?? process.env["AI_SCRUM_LINT_COMMAND"],
    workingDir: overrides.workingDir ?? process.cwd(),
  };
}
