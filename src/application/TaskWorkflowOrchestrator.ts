import type { ParseIssueUseCase } from "./usecases/ParseIssueUseCase.js";
import type { DesignAndImplementUseCase } from "./usecases/DesignAndImplementUseCase.js";
import type { ReviewUseCase } from "./usecases/ReviewUseCase.js";
import type { CreatePullRequestUseCase } from "./usecases/CreatePullRequestUseCase.js";
import type { IGitGateway } from "./ports/IGitGateway.js";
import type { ILogger } from "./ports/ILogger.js";
import type { IssueNumber } from "../domain/value-objects/IssueNumber.js";
import type { ReviewResult } from "../domain/entities/ReviewResult.js";
import { CommitMessage } from "../domain/value-objects/CommitMessage.js";
import { WorkflowError } from "../domain/errors/WorkflowError.js";

export class TaskWorkflowOrchestrator {
  constructor(
    private readonly parseIssue: ParseIssueUseCase,
    private readonly designAndImplement: DesignAndImplementUseCase,
    private readonly review: ReviewUseCase,
    private readonly createPR: CreatePullRequestUseCase,
    private readonly gitGateway: IGitGateway,
    private readonly logger: ILogger,
  ) {}

  async execute(issueNumber: IssueNumber): Promise<void> {
    this.logger.step("1/4", "Issue 解析");
    const issue = await this.parseIssue.execute(issueNumber);

    this.logger.step("2/4", "設計＆実装");
    const repoStructure = await this.gitGateway.getRepoStructure();
    const result = await this.designAndImplement.execute(issue, repoStructure);

    this.logger.step("3/4", "レビュー");
    let review: ReviewResult;
    if (result.timedOut) {
      this.logger.info(
        "⚠️  設計＆実装がタイムアウトしたため、レビューをスキップします。",
      );
      review = {
        approved: false,
        summary: "⚠️ 設計＆実装がタイムアウトしたため、レビューはスキップされました。",
      };
    } else {
      try {
        review = await this.review.execute(issue, result);
      } catch (err) {
        if (err instanceof WorkflowError && err.isTimeout) {
          this.logger.info(
            "⚠️  レビューがタイムアウトしました。スキップして PR を作成します。",
          );
          review = {
            approved: false,
            summary: "⚠️ レビューはタイムアウトのためスキップされました。",
          };
        } else {
          throw err;
        }
      }
    }

    this.logger.step("4/4", "PR 作成");
    await this.createPR.execute(issue, result, review);

    this.logger.info("Workflow completed successfully!");

    // PR作成完了後、ワークログをコミット＆プッシュ
    const worklogMessage = CommitMessage.create("chore: update worklog");
    await this.gitGateway.commitPaths(["worklog/"], worklogMessage);
    await this.gitGateway.push(result.branch);
  }
}
