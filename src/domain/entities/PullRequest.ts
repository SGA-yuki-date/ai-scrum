import type { BranchName } from "../value-objects/BranchName.js";

export interface PullRequest {
  number: number;
  url: string;
  title: string;
  branch: BranchName;
}
