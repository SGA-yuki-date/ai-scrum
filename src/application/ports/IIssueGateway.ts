import type { IssueNumber } from "../../domain/value-objects/IssueNumber.js";

export interface RawIssueData {
  title: string;
  body: string;
  labels: Array<{ name: string }>;
}

export interface IIssueGateway {
  fetchIssue(number: IssueNumber): Promise<RawIssueData>;
  updateLabels(
    number: IssueNumber,
    add: string[],
    remove: string[],
  ): Promise<void>;
}
