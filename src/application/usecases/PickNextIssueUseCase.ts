import type { IIssueGateway, ReadyIssueSummary } from "../ports/IIssueGateway.js";
import type { ILogger } from "../ports/ILogger.js";

const PRIORITY_ORDER: string[] = [
  "ai-scrum:issue:priority:P0-immediately",
  "ai-scrum:issue:priority:P1-high",
  "ai-scrum:issue:priority:P2-medium",
  "ai-scrum:issue:priority:P3-low",
];

function getPriorityRank(labels: string[]): number {
  for (let i = 0; i < PRIORITY_ORDER.length; i++) {
    if (labels.includes(PRIORITY_ORDER[i])) {
      return i;
    }
  }
  // No priority label → lowest priority (after P3)
  return PRIORITY_ORDER.length;
}

export class PickNextIssueUseCase {
  constructor(
    private readonly issueGateway: IIssueGateway,
    private readonly logger: ILogger,
    private readonly readyLabel: string,
  ) {}

  async execute(): Promise<ReadyIssueSummary | undefined> {
    this.logger.info("Searching for ready issues...");
    const issues = await this.issueGateway.listReadyIssues(this.readyLabel);

    if (issues.length === 0) {
      this.logger.info("No ready issues found.");
      return undefined;
    }

    issues.sort((a, b) => {
      const priorityDiff = getPriorityRank(a.labels) - getPriorityRank(b.labels);
      if (priorityDiff !== 0) return priorityDiff;
      return a.number - b.number;
    });

    const picked = issues[0];
    this.logger.info(
      `Found ${issues.length} ready issue(s). Next: #${picked.number} "${picked.title}"`,
    );
    return picked;
  }
}
