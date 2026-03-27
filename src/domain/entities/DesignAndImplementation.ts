import type { BranchName } from "../value-objects/BranchName.js";

export interface FileChange {
  path: string;
  action: "create" | "modify" | "delete";
}

export interface TestResults {
  passed: boolean;
  summary: string;
}

export interface DesignAndImplementation {
  approach: string;
  targetFiles: FileChange[];
  testStrategy: string;
  designMarkdown: string;
  branch: BranchName;
  changedFiles: string[];
  diffStat: string;
  testResults: TestResults;
  commitHash: string;
}
