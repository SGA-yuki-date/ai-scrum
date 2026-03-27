import type { IIssueGateway } from "../ports/IIssueGateway.js";
import type { ILogger } from "../ports/ILogger.js";
import type { TaskIssue } from "../../domain/entities/TaskIssue.js";
import { IssueNumber } from "../../domain/value-objects/IssueNumber.js";
import { WorkflowError } from "../../domain/errors/WorkflowError.js";

export class ParseIssueUseCase {
  constructor(
    private readonly issueGateway: IIssueGateway,
    private readonly logger: ILogger,
    private readonly labels: { inProgress: string },
  ) {}

  async execute(issueNumber: IssueNumber): Promise<TaskIssue> {
    this.logger.info(`Fetching issue ${issueNumber}...`);
    const raw = await this.issueGateway.fetchIssue(issueNumber);
    const parsed = this.parseBody(raw.body);

    if (!parsed.description) {
      throw new WorkflowError("Issue is missing required field: タスク概要", "parse-issue");
    }
    if (parsed.requirements.length === 0) {
      throw new WorkflowError("Issue is missing required field: 要件", "parse-issue");
    }
    if (parsed.acceptanceCriteria.length === 0) {
      throw new WorkflowError("Issue is missing required field: 受け入れ条件", "parse-issue");
    }

    await this.issueGateway.updateLabels(
      issueNumber,
      [this.labels.inProgress],
      ["status:ready"],
    );
    this.logger.info(`Labels updated to ${this.labels.inProgress}`);

    const issue: TaskIssue = {
      number: issueNumber,
      title: raw.title,
      description: parsed.description,
      requirements: parsed.requirements,
      acceptanceCriteria: parsed.acceptanceCriteria,
      technicalContext: parsed.technicalContext,
      parentStory: parsed.parentStory
        ? IssueNumber.create(parsed.parentStory)
        : undefined,
      labels: raw.labels.map((l) => l.name),
    };

    this.logger.info(`Parsed issue: "${issue.title}"`);
    return issue;
  }

  private parseBody(body: string): {
    description: string;
    requirements: string[];
    acceptanceCriteria: string[];
    technicalContext?: string;
    parentStory?: number;
  } {
    const sections = this.extractSections(body);
    return {
      description: sections["タスク概要"] ?? "",
      requirements: this.parseList(sections["要件"] ?? ""),
      acceptanceCriteria: this.parseList(sections["受け入れ条件"] ?? ""),
      technicalContext: sections["技術コンテキスト"] || undefined,
      parentStory: this.parseParentStory(sections["親ストーリー Issue 番号"] ?? ""),
    };
  }

  private extractSections(body: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const sectionRegex = /### (.+)\n\n([\s\S]*?)(?=\n### |\n*$)/g;
    let match: RegExpExecArray | null;
    while ((match = sectionRegex.exec(body)) !== null) {
      sections[match[1].trim()] = match[2].trim();
    }
    return sections;
  }

  private parseList(text: string): string[] {
    return text
      .split("\n")
      .map((line) => line.replace(/^[-*]\s*/, "").trim())
      .filter((line) => line.length > 0);
  }

  private parseParentStory(text: string): number | undefined {
    const match = text.match(/#?(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }
}
