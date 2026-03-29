import type { IGitGateway } from "../ports/IGitGateway.js";
import type { IAIService } from "../ports/IAIService.js";
import type { IPromptRenderer } from "../ports/IPromptRenderer.js";
import type { ILogger } from "../ports/ILogger.js";
import type { TaskIssue } from "../../domain/entities/TaskIssue.js";
import type { DesignAndImplementation } from "../../domain/entities/DesignAndImplementation.js";
import { BranchName } from "../../domain/value-objects/BranchName.js";
import { CommitMessage } from "../../domain/value-objects/CommitMessage.js";
import { WorkflowError } from "../../domain/errors/WorkflowError.js";

export class DesignAndImplementUseCase {
  constructor(
    private readonly gitGateway: IGitGateway,
    private readonly aiService: IAIService,
    private readonly promptRenderer: IPromptRenderer,
    private readonly logger: ILogger,
    private readonly config: {
      baseBranch: string;
      branchPrefix: string;
      testCommand?: string;
      lintCommand?: string;
      workingDir: string;
    },
  ) {}

  async execute(
    issue: TaskIssue,
    repoStructure: string,
  ): Promise<DesignAndImplementation> {
    const prompt = await this.promptRenderer.render("design-and-implement", {
      title: issue.title,
      description: issue.description,
      requirements: issue.requirements.join("\n- "),
      acceptanceCriteria: issue.acceptanceCriteria.join("\n- "),
      technicalContext: issue.technicalContext ?? "なし",
      repoStructure,
    });

    const branch = BranchName.fromIssueNumber(
      issue.number.value,
      issue.title,
      this.config.branchPrefix,
    );
    await this.gitGateway.createBranch(branch);
    this.logger.info(`Created branch: ${branch}`);

    this.logger.info("Invoking AI Coding Agent for design & implementation...");
    let aiResponse: string;
    let timedOut = false;
    try {
      aiResponse = await this.aiService.invoke(prompt, this.config.workingDir);
    } catch (err) {
      if (err instanceof WorkflowError && err.isTimeout) {
        this.logger.info(
          "⚠️  設計＆実装がタイムアウトしました。途中の変更をコミットして続行します。",
        );
        timedOut = true;
        aiResponse = "";
      } else {
        throw err;
      }
    }

    const hasChanges = await this.gitGateway.hasChanges();
    if (!hasChanges && !timedOut) {
      throw new WorkflowError(
        "AI did not produce any file changes.",
        "design-and-implement",
      );
    }

    const commitMessage = timedOut
      ? CommitMessage.create("wip: partial implementation (timed out)")
      : CommitMessage.forTask(issue.title);
    const commitHash = hasChanges
      ? await this.gitGateway.commitAll(commitMessage)
      : "";
    if (hasChanges) {
      await this.gitGateway.push(branch);
      this.logger.info(`Committed and pushed: ${commitHash}`);
    }

    // ベースブランチとの差分統計をコミット後に取得（AI が自己コミットした分も含む）
    const diffStat = hasChanges
      ? await this.gitGateway.diffStatAgainstBase(this.config.baseBranch)
      : "";
    if (diffStat) {
      this.logger.info(`Changes vs base branch:\n${diffStat}`);
    }

    const changedFiles = diffStat
      .split("\n")
      .filter((line) => line.includes("|"))
      .map((line) => line.trim().split("|")[0]?.trim())
      .filter((f): f is string => !!f && f.length > 0);

    return {
      branch,
      changedFiles,
      diffStat,
      commitHash,
      timedOut,
    };
  }
}
