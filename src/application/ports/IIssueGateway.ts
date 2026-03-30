import type { IssueNumber } from "../../domain/value-objects/IssueNumber.js";

export interface RawIssueData {
  title: string;
  body: string;
  labels: Array<{ name: string }>;
}

export interface ReadyIssueSummary {
  number: number;
  title: string;
  labels: string[];
}

export interface IIssueGateway {
  fetchIssue(number: IssueNumber): Promise<RawIssueData>;
  listReadyIssues(readyLabel: string): Promise<ReadyIssueSummary[]>;
  updateLabels(
    number: IssueNumber,
    add: string[],
    remove: string[],
  ): Promise<void>;
}
