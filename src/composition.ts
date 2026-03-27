import { resolve } from "node:path";
import { TaskWorkflowOrchestrator } from "./application/TaskWorkflowOrchestrator.js";
import { ParseIssueUseCase } from "./application/usecases/ParseIssueUseCase.js";
import { DesignAndImplementUseCase } from "./application/usecases/DesignAndImplementUseCase.js";
import { ReviewUseCase } from "./application/usecases/ReviewUseCase.js";
import { CreatePullRequestUseCase } from "./application/usecases/CreatePullRequestUseCase.js";
import { GhCliIssueGateway } from "./infrastructure/github/GhCliIssueGateway.js";
import { GhCliPullRequestGateway } from "./infrastructure/github/GhCliPullRequestGateway.js";
import { GitCliGateway } from "./infrastructure/git/GitCliGateway.js";
import { CliAIService } from "./infrastructure/ai/CliAIService.js";
import { SimplePromptRenderer } from "./infrastructure/prompt/SimplePromptRenderer.js";
import { ConsoleLogger } from "./infrastructure/logger/ConsoleLogger.js";
import type { WorkflowConfig } from "./adapter/config/WorkflowConfig.js";

export function createWorkflow(
  config: WorkflowConfig,
): TaskWorkflowOrchestrator {
  const logger = new ConsoleLogger();
  const issueGateway = new GhCliIssueGateway();
  const gitGateway = new GitCliGateway();
  const prGateway = new GhCliPullRequestGateway();
  // TODO: 将来的に GitHub Copilot 以外の AI Agent にも対応を検討する
  const aiService = new CliAIService("gh copilot", config.aiTimeout);
  const promptRenderer = new SimplePromptRenderer(
    resolve(config.workingDir, "prompts"),
  );

  return new TaskWorkflowOrchestrator(
    new ParseIssueUseCase(issueGateway, logger, {
      inProgress: config.labels.inProgress,
    }),
    new DesignAndImplementUseCase(gitGateway, aiService, promptRenderer, logger, {
      baseBranch: config.baseBranch,
      branchPrefix: config.branchPrefix,
      testCommand: config.testCommand,
      lintCommand: config.lintCommand,
      workingDir: config.workingDir,
    }),
    new ReviewUseCase(gitGateway, aiService, promptRenderer, logger, {
      baseBranch: config.baseBranch,
      workingDir: config.workingDir,
    }),
    new CreatePullRequestUseCase(prGateway, issueGateway, promptRenderer, logger, {
      baseBranch: config.baseBranch,
      labels: { inReview: config.labels.inReview },
    }),
    gitGateway,
    logger,
  );
}
