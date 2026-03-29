import type { BranchName } from "../value-objects/BranchName.js";

export interface DesignAndImplementation {
  branch: BranchName;
  changedFiles: string[];
  diffStat: string;
  commitHash: string;
  /** true when the AI timed out during design & implementation */
  timedOut?: boolean;
}
