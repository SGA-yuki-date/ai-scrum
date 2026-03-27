import { WorkflowError } from "../errors/WorkflowError.js";

export class BranchName {
  private constructor(readonly value: string) {}

  static fromIssueNumber(
    issueNumber: number,
    title: string,
    prefix = "task/",
  ): BranchName {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    return new BranchName(`${prefix}${issueNumber}-${slug}`);
  }

  static create(value: string): BranchName {
    if (!/^[a-zA-Z0-9\/_.-]+$/.test(value)) {
      throw new WorkflowError(`Invalid branch name: ${value}`);
    }
    return new BranchName(value);
  }

  toString(): string {
    return this.value;
  }
}
