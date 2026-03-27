import type { ParseIssueUseCase } from "./usecases/ParseIssueUseCase.js";
import type { DesignAndImplementUseCase } from "./usecases/DesignAndImplementUseCase.js";
import type { ReviewUseCase } from "./usecases/ReviewUseCase.js";
import type { CreatePullRequestUseCase } from "./usecases/CreatePullRequestUseCase.js";
import type { IGitGateway } from "./ports/IGitGateway.js";
import type { ILogger } from "./ports/ILogger.js";
import type { IssueNumber } from "../domain/value-objects/IssueNumber.js";

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
    const review = await this.review.execute(issue, result);

    this.logger.step("4/4", "PR 作成");
    await this.createPR.execute(issue, result, review);

    this.logger.info("Workflow completed successfully!");
  }
}
