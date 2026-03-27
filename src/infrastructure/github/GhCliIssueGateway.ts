import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  IIssueGateway,
  RawIssueData,
} from "../../application/ports/IIssueGateway.js";
import type { IssueNumber } from "../../domain/value-objects/IssueNumber.js";
import { WorkflowError } from "../../domain/errors/WorkflowError.js";

const execFileAsync = promisify(execFile);

export class GhCliIssueGateway implements IIssueGateway {
  async fetchIssue(number: IssueNumber): Promise<RawIssueData> {
    try {
      const { stdout } = await execFileAsync("gh", [
        "issue",
        "view",
        String(number.value),
        "--json",
        "title,body,labels",
      ]);
      const data = JSON.parse(stdout);
      return { title: data.title, body: data.body, labels: data.labels };
    } catch (error) {
      throw new WorkflowError(
        `Failed to fetch issue ${number}: ${error instanceof Error ? error.message : String(error)}`,
        "parse-issue",
      );
    }
  }

  async updateLabels(
    number: IssueNumber,
    add: string[],
    remove: string[],
  ): Promise<void> {
    const args = ["issue", "edit", String(number.value)];
    for (const label of add) {
      args.push("--add-label", label);
    }
    for (const label of remove) {
      args.push("--remove-label", label);
    }
    try {
      await execFileAsync("gh", args);
    } catch (error) {
      throw new WorkflowError(
        `Failed to update labels for issue ${number}: ${error instanceof Error ? error.message : String(error)}`,
        "parse-issue",
      );
    }
  }
}
