import type { BranchName } from "../../domain/value-objects/BranchName.js";
import type { CommitMessage } from "../../domain/value-objects/CommitMessage.js";

export interface IGitGateway {
  createBranch(name: BranchName): Promise<void>;
  hasChanges(): Promise<boolean>;
  diffStat(): Promise<string>;
  diffStatAgainstBase(baseBranch: string): Promise<string>;
  diffAgainstBase(baseBranch: string): Promise<string>;
  commitAll(message: CommitMessage): Promise<string>;
  commitPaths(paths: string[], message: CommitMessage): Promise<void>;
  push(branch: BranchName): Promise<void>;
  getRepoStructure(): Promise<string>;
}
