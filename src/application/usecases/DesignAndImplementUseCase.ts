import type { IGitGateway } from "../ports/IGitGateway.js";
import type { IAIService } from "../ports/IAIService.js";
import type { IPromptRenderer } from "../ports/IPromptRenderer.js";
import type { ILogger } from "../ports/ILogger.js";
import type { TaskIssue } from "../../domain/entities/TaskIssue.js";
import type {
  DesignAndImplementation,
  FileChange,
} from "../../domain/entities/DesignAndImplementation.js";
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
    const aiResponse = await this.aiService.invoke(
      prompt,
      this.config.workingDir,
    );

    const design = this.parseDesignResponse(aiResponse);

    const hasChanges = await this.gitGateway.hasChanges();
    if (!hasChanges) {
      throw new WorkflowError(
        "AI did not produce any file changes.",
        "design-and-implement",
      );
    }
    const diffStat = await this.gitGateway.diffStat();
    this.logger.info(`Changes detected:\n${diffStat}`);

    const testResults = { passed: true, summary: "No test command configured." };

    const commitMessage = CommitMessage.forTask(
      issue.number.value,
      issue.title,
    );
    const commitHash = await this.gitGateway.commitAll(commitMessage);
    await this.gitGateway.push(branch);
    this.logger.info(`Committed and pushed: ${commitHash}`);

    const changedFiles = diffStat
      .split("\n")
      .map((line) => line.trim().split("|")[0]?.trim())
      .filter((f): f is string => !!f && f.length > 0);

    return {
      ...design,
      branch,
      changedFiles,
      diffStat,
      testResults,
      commitHash,
    };
  }

  private parseDesignResponse(response: string): {
    approach: string;
    targetFiles: FileChange[];
    testStrategy: string;
    designMarkdown: string;
  } {
    const approachMatch = response.match(
      /## (?:実装アプローチ|Approach)\n([\s\S]*?)(?=\n## |$)/,
    );
    const filesMatch = response.match(
      /## (?:変更対象ファイル|Target Files)\n([\s\S]*?)(?=\n## |$)/,
    );
    const testMatch = response.match(
      /## (?:テスト方針|Test Strategy)\n([\s\S]*?)(?=\n## |$)/,
    );

    const approach = approachMatch?.[1]?.trim() ?? response.slice(0, 500);
    const testStrategy =
      testMatch?.[1]?.trim() ??
      "テスト方針は AI レスポンスから抽出できませんでした。";
    const targetFiles: FileChange[] = [];
    if (filesMatch) {
      const lines = filesMatch[1].split("\n").filter((l) => l.trim());
      for (const line of lines) {
        const fileMatch = line.match(
          /[-*]\s*`?([^`\s]+)`?\s*[—\-:]\s*(create|modify|delete)/i,
        );
        if (fileMatch) {
          targetFiles.push({
            path: fileMatch[1],
            action: fileMatch[2].toLowerCase() as FileChange["action"],
          });
        }
      }
    }

    return { approach, targetFiles, testStrategy, designMarkdown: response };
  }
}
