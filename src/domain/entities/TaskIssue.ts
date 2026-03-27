import type { IssueNumber } from "../value-objects/IssueNumber.js";

export interface TaskIssue {
  number: IssueNumber;
  title: string;
  description: string;
  requirements: string[];
  acceptanceCriteria: string[];
  technicalContext?: string;
  parentStory?: IssueNumber;
  labels: string[];
}
