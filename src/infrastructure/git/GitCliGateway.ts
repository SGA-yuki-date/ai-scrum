import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { IGitGateway } from "../../application/ports/IGitGateway.js";
import type { BranchName } from "../../domain/value-objects/BranchName.js";
import type { CommitMessage } from "../../domain/value-objects/CommitMessage.js";
import { WorkflowError } from "../../domain/errors/WorkflowError.js";

const execFileAsync = promisify(execFile);

export class GitCliGateway implements IGitGateway {
  async createBranch(name: BranchName): Promise<void> {
    try {
      await execFileAsync("git", ["switch", "-c", name.value]);
    } catch (error) {
      throw new WorkflowError(
        `Failed to create branch ${name}: ${error instanceof Error ? error.message : String(error)}`,
        "design-and-implement",
      );
    }
  }

  async hasChanges(): Promise<boolean> {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"]);
    return stdout.trim().length > 0;
  }

  async diffStat(): Promise<string> {
    await execFileAsync("git", ["add", "-A"]);
    const { stdout } = await execFileAsync("git", [
      "diff",
      "--cached",
      "--stat",
    ]);
    return stdout.trim();
  }

  async diffAgainstBase(baseBranch: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync("git", [
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
      await execFileAsync("git", ["add", "-A"]);
      await execFileAsync("git", ["commit", "-m", message.value]);
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"]);
      return stdout.trim();
    } catch (error) {
      throw new WorkflowError(
        `Failed to commit: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async push(branch: BranchName): Promise<void> {
    try {
      await execFileAsync("git", ["push", "origin", branch.value]);
    } catch (error) {
      throw new WorkflowError(
        `Failed to push branch ${branch}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getRepoStructure(): Promise<string> {
    try {
      const { stdout } = await execFileAsync("git", ["ls-files"]);
      return stdout.trim();
    } catch {
      return "(Could not retrieve repository structure)";
    }
  }
}
