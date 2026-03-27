import type { IGitGateway } from "../ports/IGitGateway.js";
import type { IAIService } from "../ports/IAIService.js";
import type { IPromptRenderer } from "../ports/IPromptRenderer.js";
import type { ILogger } from "../ports/ILogger.js";
import type { TaskIssue } from "../../domain/entities/TaskIssue.js";
import type { DesignAndImplementation } from "../../domain/entities/DesignAndImplementation.js";
import type {
  ReviewResult,
  ReviewFinding,
} from "../../domain/entities/ReviewResult.js";
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

    const prompt = await this.promptRenderer.render("review", {
      title: issue.title,
      approach: result.approach,
      acceptanceCriteria: issue.acceptanceCriteria.join("\n- "),
      diff,
    });

    this.logger.info("Invoking AI Coding Agent for review...");
    const aiResponse = await this.aiService.invoke(
      prompt,
      this.config.workingDir,
    );

    const reviewResult = this.parseReviewResponse(aiResponse);

    const hasChanges = await this.gitGateway.hasChanges();
    if (hasChanges) {
      this.logger.info("AI applied fixes during review. Committing...");
      const commitMessage = CommitMessage.create(
        `fix(#${issue.number.value}): address review findings`,
      );
      await this.gitGateway.commitAll(commitMessage);
      await this.gitGateway.push(result.branch);
      reviewResult.fixesApplied.push("Review fixes committed and pushed.");
    }

    return reviewResult;
  }

  private parseReviewResponse(response: string): ReviewResult {
    const findings: ReviewFinding[] = [];
    const findingsMatch = response.match(
      /## (?:指摘事項|Findings)\n([\s\S]*?)(?=\n## |$)/,
    );
    if (findingsMatch) {
      const lines = findingsMatch[1]
        .split("\n")
        .filter((l) => l.trim().startsWith("-"));
      for (const line of lines) {
        const severityMatch = line.match(/\[(error|warning|info)\]/i);
        findings.push({
          severity:
            (severityMatch?.[1]?.toLowerCase() as ReviewFinding["severity"]) ??
            "info",
          message: line.replace(/^-\s*(\[.*?\])?\s*/, "").trim(),
        });
      }
    }

    const approved = !findings.some((f) => f.severity === "error");
    const summaryMatch = response.match(
      /## (?:サマリー|Summary)\n([\s\S]*?)(?=\n## |$)/,
    );
    const summary = summaryMatch?.[1]?.trim() ?? response.slice(0, 500);

    return { approved, findings, fixesApplied: [], summary };
  }
}
