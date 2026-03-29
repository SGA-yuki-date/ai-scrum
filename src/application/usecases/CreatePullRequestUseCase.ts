import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { IPullRequestGateway } from "../ports/IPullRequestGateway.js";
import type { IIssueGateway } from "../ports/IIssueGateway.js";
import type { IAIService } from "../ports/IAIService.js";
import type { IGitGateway } from "../ports/IGitGateway.js";
import type { IPromptRenderer } from "../ports/IPromptRenderer.js";
import type { ILogger } from "../ports/ILogger.js";
import type { TaskIssue } from "../../domain/entities/TaskIssue.js";
import type { DesignAndImplementation } from "../../domain/entities/DesignAndImplementation.js";
import type { ReviewResult } from "../../domain/entities/ReviewResult.js";
import type { PullRequest } from "../../domain/entities/PullRequest.js";

/** diff が長すぎる場合に末尾を省略するための上限文字数 */
const MAX_DIFF_CHARS = 20_000;

export class CreatePullRequestUseCase {
  constructor(
    private readonly prGateway: IPullRequestGateway,
    private readonly issueGateway: IIssueGateway,
    private readonly aiService: IAIService,
    private readonly gitGateway: IGitGateway,
    private readonly promptRenderer: IPromptRenderer,
    private readonly logger: ILogger,
    private readonly config: {
      baseBranch: string;
      workingDir: string;
      labels: { inReview: string };
    },
  ) {}

  async execute(
    issue: TaskIssue,
    result: DesignAndImplementation,
    review: ReviewResult,
  ): Promise<PullRequest> {
    // ワークログを読み込む（PR本文生成の入力として使用）
    const worklogPath = join(
      this.config.workingDir,
      "worklog",
      `task_${issue.number.value}.txt`,
    );
    let worklog: string;
    try {
      worklog = readFileSync(worklogPath, "utf-8");
    } catch {
      worklog = "(ワークログが見つかりませんでした)";
    }

    // ベースブランチとの差分を取得（長すぎる場合は省略）
    let diff: string;
    try {
      const fullDiff = await this.gitGateway.diffAgainstBase(this.config.baseBranch);
      diff =
        fullDiff.length > MAX_DIFF_CHARS
          ? fullDiff.slice(0, MAX_DIFF_CHARS) + "\n\n... (差分が長すぎるため省略)"
          : fullDiff;
    } catch {
      diff = "(差分の取得に失敗しました)";
    }

    const prompt = await this.promptRenderer.render("pr-body", {
      issueNumber: issue.number.value,
      title: issue.title,
      description: issue.description,
      worklog,
      diff,
      reviewApproved: review.approved ? "✅ Approved" : "⚠️ Needs attention",
      reviewSummary: review.summary,
    });

    this.logger.info("Invoking AI to generate PR body...");
    const body = await this.aiService.invoke(prompt, this.config.workingDir);

    const title = `feat(#${issue.number.value}): ${issue.title}`;
    const pr = await this.prGateway.create({
      title,
      body,
      base: this.config.baseBranch,
      head: result.branch.value,
    });
    this.logger.info(`PR created: ${pr.url}`);

    await this.issueGateway.updateLabels(
      issue.number,
      [this.config.labels.inReview],
      ["ai-scrum:issue:status:in-progress"],
    );
    this.logger.info(`Labels updated to ${this.config.labels.inReview}`);

    return pr;
  }
}
