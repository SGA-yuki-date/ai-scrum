import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { IPullRequestGateway } from "../../application/ports/IPullRequestGateway.js";
import type { PullRequest } from "../../domain/entities/PullRequest.js";
import { BranchName } from "../../domain/value-objects/BranchName.js";
import { WorkflowError } from "../../domain/errors/WorkflowError.js";

const execFileAsync = promisify(execFile);

export class GhCliPullRequestGateway implements IPullRequestGateway {
  async create(params: {
    title: string;
    body: string;
    base: string;
    head: string;
  }): Promise<PullRequest> {
    try {
      const { stdout } = await execFileAsync("gh", [
        "pr",
        "create",
        "--title",
        params.title,
        "--body",
        params.body,
        "--base",
        params.base,
        "--head",
        params.head,
        "--json",
        "number,url,title",
      ]);
      const data = JSON.parse(stdout);
      return {
        number: data.number,
        url: data.url,
        title: data.title,
        branch: BranchName.create(params.head),
      };
    } catch (error) {
      throw new WorkflowError(
        `Failed to create PR: ${error instanceof Error ? error.message : String(error)}`,
        "create-pr",
      );
    }
  }
}
