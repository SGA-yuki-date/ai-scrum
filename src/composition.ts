import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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
import { TeeLogger } from "./infrastructure/logger/TeeLogger.js";
import type { WorkflowConfig } from "./adapter/config/WorkflowConfig.js";

export function createWorkflow(
  config: WorkflowConfig,
  issueNumber: number,
): TaskWorkflowOrchestrator {
  const worklogPath = join(config.workingDir, "worklog", `task_${issueNumber}.txt`);
  const logger = new TeeLogger(worklogPath);
  const issueGateway = new GhCliIssueGateway();
  const gitGateway = new GitCliGateway();
  const prGateway = new GhCliPullRequestGateway();
  // TODO: 将来的に GitHub Copilot 以外の AI Agent にも対応を検討する
  // gh copilot の非インタラクティブモード: -- -p でプロンプトを渡す
  const aiService = new CliAIService(
    "gh copilot -- --allow-all-tools -p",
    config.aiTimeout,
    logger,
  );
  // プロンプトテンプレートはビルド時に dist/src/prompts/ にコピーされる
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const promptRenderer = new SimplePromptRenderer(
    resolve(srcDir, "prompts"),
  );

  return new TaskWorkflowOrchestrator(
    new ParseIssueUseCase(issueGateway, logger, {
      ready: config.labels.ready,
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
    new CreatePullRequestUseCase(prGateway, issueGateway, aiService, gitGateway, promptRenderer, logger, {
      baseBranch: config.baseBranch,
      workingDir: config.workingDir,
      labels: { inReview: config.labels.inReview },
    }),
    gitGateway,
    logger,
  );
}
