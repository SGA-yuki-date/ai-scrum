import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IGitGateway } from "../ports/IGitGateway.js";
import type { IAIService } from "../ports/IAIService.js";
import type { IPromptRenderer } from "../ports/IPromptRenderer.js";
import type { ILogger } from "../ports/ILogger.js";
import type { TaskIssue } from "../../domain/entities/TaskIssue.js";
import type { DesignAndImplementation } from "../../domain/entities/DesignAndImplementation.js";
import type { ReviewResult } from "../../domain/entities/ReviewResult.js";
import { CommitMessage } from "../../domain/value-objects/CommitMessage.js";

export class ReviewUseCase {
  constructor(
    private readonly gitGateway: IGitGateway,
    private readonly aiService: IAIService,
    private readonly promptRenderer: IPromptRenderer,
    private readonly logger: ILogger,
    private readonly config: {
      baseBranch: string;
      workingDir: string;
    },
  ) {}

  async execute(
    issue: TaskIssue,
    result: DesignAndImplementation,
  ): Promise<ReviewResult> {
    const diff = await this.gitGateway.diffAgainstBase(this.config.baseBranch);
    this.logger.info(`Diff size: ${diff.length} characters`);

    const worklogPath = join(
      this.config.workingDir,
      "worklog",
      `task_${issue.number.value}.txt`,
    );
    let worklog: string;
    try {
      worklog = readFileSync(worklogPath, "utf-8");
    } catch {
      worklog = "(作業ログが見つかりませんでした)";
    }

    const prompt = await this.promptRenderer.render("review", {
      title: issue.title,
      worklog,
      acceptanceCriteria: issue.acceptanceCriteria.join("\n- "),
      diff,
    });

    this.logger.info("Invoking AI Coding Agent for review...");
    const aiResponse = await this.aiService.invoke(
      prompt,
      this.config.workingDir,
    );

    // AIレスポンス全体をサマリーとして使用し、error キーワードがあれば要注意と判定
    const approved = !/\[error\]/i.test(aiResponse);
    const reviewResult: ReviewResult = {
      approved,
      summary: aiResponse,
    };

    const hasChanges = await this.gitGateway.hasChanges();
    if (hasChanges) {
      this.logger.info("AI applied fixes during review. Committing...");
      const commitMessage = CommitMessage.create(
        "fix: address review findings",
      );
      await this.gitGateway.commitAll(commitMessage);
      await this.gitGateway.push(result.branch);
    }

    return reviewResult;
  }
}
