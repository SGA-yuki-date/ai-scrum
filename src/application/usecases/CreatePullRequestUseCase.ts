import type { IPullRequestGateway } from "../ports/IPullRequestGateway.js";
import type { IIssueGateway } from "../ports/IIssueGateway.js";
import type { IPromptRenderer } from "../ports/IPromptRenderer.js";
import type { ILogger } from "../ports/ILogger.js";
import type { TaskIssue } from "../../domain/entities/TaskIssue.js";
import type { DesignAndImplementation } from "../../domain/entities/DesignAndImplementation.js";
import type { ReviewResult } from "../../domain/entities/ReviewResult.js";
import type { PullRequest } from "../../domain/entities/PullRequest.js";

export class CreatePullRequestUseCase {
  constructor(
    private readonly prGateway: IPullRequestGateway,
    private readonly issueGateway: IIssueGateway,
    private readonly promptRenderer: IPromptRenderer,
    private readonly logger: ILogger,
    private readonly config: {
      baseBranch: string;
      labels: { inReview: string };
    },
  ) {}

  async execute(
    issue: TaskIssue,
    result: DesignAndImplementation,
    review: ReviewResult,
  ): Promise<PullRequest> {
    const body = await this.promptRenderer.render("pr-body", {
      issueNumber: issue.number.value,
      description: issue.description,
      designMarkdown: result.designMarkdown,
      changedFiles: result.changedFiles.join("\n- "),
      diffStat: result.diffStat,
      testResults: result.testResults.summary,
      reviewSummary: review.summary,
      reviewApproved: review.approved ? "✅ Approved" : "⚠️ Needs attention",
    });

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
      ["status:in-progress"],
    );
    this.logger.info(`Labels updated to ${this.config.labels.inReview}`);

    return pr;
  }
}
