import { WorkflowError } from "../errors/WorkflowError.js";

export class IssueNumber {
  private constructor(readonly value: number) {}

  static create(n: number): IssueNumber {
    if (!Number.isInteger(n) || n <= 0) {
      throw new WorkflowError(
        `Invalid issue number: ${n}. Must be a positive integer.`,
      );
    }
    return new IssueNumber(n);
  }

  toString(): string {
    return `#${this.value}`;
  }
}
