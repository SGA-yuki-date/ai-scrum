import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import type { IPullRequestGateway } from "../../application/ports/IPullRequestGateway.js";
import type { PullRequest } from "../../domain/entities/PullRequest.js";
import { BranchName } from "../../domain/value-objects/BranchName.js";
import { WorkflowError } from "../../domain/errors/WorkflowError.js";
import { bashExec } from "../shell/BashRunner.js";

export class GhCliPullRequestGateway implements IPullRequestGateway {
  async create(params: {
    title: string;
    body: string;
    base: string;
    head: string;
  }): Promise<PullRequest> {
    const bodyFile = join(
      tmpdir(),
      `ai-scrum-pr-body-${randomBytes(8).toString("hex")}.md`,
    );
    writeFileSync(bodyFile, params.body, "utf-8");
    try {
      const { stdout } = await bashExec("gh", [
        "pr",
        "create",
        "--title",
        params.title,
        "--body-file",
        bodyFile,
        "--base",
        params.base,
        "--head",
        params.head,
      ]);
      // gh pr create outputs the PR URL on success
      const url = stdout.trim();
      const numberMatch = url.match(/\/pull\/(\d+)$/);
      const number = numberMatch ? parseInt(numberMatch[1], 10) : 0;
      return {
        number,
        url,
        title: params.title,
        branch: BranchName.create(params.head),
      };
    } catch (error) {
      throw new WorkflowError(
        `Failed to create PR: ${error instanceof Error ? error.message : String(error)}`,
        "create-pr",
      );
    } finally {
      try { unlinkSync(bodyFile); } catch { /* ignore */ }
    }
  }
}
