import { WorkflowError } from "../errors/WorkflowError.js";

export class CommitMessage {
  private constructor(readonly value: string) {}

  static forTask(issueNumber: number, summary: string): CommitMessage {
    const sanitized = summary.replace(/\n/g, " ").trim();
    if (!sanitized) {
      throw new WorkflowError("Commit message summary cannot be empty.");
    }
    return new CommitMessage(`feat(#${issueNumber}): ${sanitized}`);
  }

  static create(value: string): CommitMessage {
    if (!value.trim()) {
      throw new WorkflowError("Commit message cannot be empty.");
    }
    return new CommitMessage(value.trim());
  }

  toString(): string {
    return this.value;
  }
}
