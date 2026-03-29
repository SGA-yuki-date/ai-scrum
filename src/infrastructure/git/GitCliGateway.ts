import type { IGitGateway } from "../../application/ports/IGitGateway.js";
import type { BranchName } from "../../domain/value-objects/BranchName.js";
import type { CommitMessage } from "../../domain/value-objects/CommitMessage.js";
import { WorkflowError } from "../../domain/errors/WorkflowError.js";
import { bashExec } from "../shell/BashRunner.js";

export class GitCliGateway implements IGitGateway {
  async createBranch(name: BranchName): Promise<void> {
    try {
      await bashExec("git", ["switch", "-c", name.value]);
    } catch (error) {
      throw new WorkflowError(
        `Failed to create branch ${name}: ${error instanceof Error ? error.message : String(error)}`,
        "design-and-implement",
      );
    }
  }

  async hasChanges(): Promise<boolean> {
    const { stdout } = await bashExec("git", ["status", "--porcelain"]);
    return stdout.trim().length > 0;
  }

  async diffStat(): Promise<string> {
    await bashExec("git", ["add", "-A"]);
    const { stdout } = await bashExec("git", [
      "diff",
      "--cached",
      "--stat",
    ]);
    return stdout.trim();
  }

  async diffStatAgainstBase(baseBranch: string): Promise<string> {
    try {
      const { stdout } = await bashExec("git", [
        "diff",
        "--stat",
        baseBranch,
      ]);
      return stdout.trim();
    } catch (error) {
      throw new WorkflowError(
        `Failed to get diff stat against ${baseBranch}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async diffAgainstBase(baseBranch: string): Promise<string> {
    try {
      const { stdout } = await bashExec("git", [
        "diff",
        baseBranch,
      ]);
      return stdout;
    } catch (error) {
      throw new WorkflowError(
        `Failed to get diff against ${baseBranch}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async commitAll(message: CommitMessage): Promise<string> {
    try {
      await bashExec("git", ["add", "-A"]);
      await bashExec("git", ["commit", "-m", message.value]);
      const { stdout } = await bashExec("git", ["rev-parse", "HEAD"]);
      return stdout.trim();
    } catch (error) {
      throw new WorkflowError(
        `Failed to commit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async commitPaths(paths: string[], message: CommitMessage): Promise<void> {
    try {
      await bashExec("git", ["add", "--", ...paths]);
      // git diff --cached --quiet exits 0 (no staged changes) or 1 (has staged changes)
      const hasStagedChanges = await bashExec("git", ["diff", "--cached", "--quiet"])
        .then(() => false)
        .catch(() => true);
      if (!hasStagedChanges) return;
      await bashExec("git", ["commit", "-m", message.value]);
    } catch (error) {
      throw new WorkflowError(
        `Failed to commit paths: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async push(branch: BranchName): Promise<void> {
    try {
      await bashExec("git", ["push", "origin", branch.value]);
    } catch (error) {
      throw new WorkflowError(
        `Failed to push branch ${branch}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getRepoStructure(): Promise<string> {
    try {
      const { stdout } = await bashExec("git", ["ls-files"]);
      return stdout.trim();
    } catch {
      return "(Could not retrieve repository structure)";
    }
  }
}
