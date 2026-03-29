import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { ParseIssueUseCase } from "../../../src/application/usecases/ParseIssueUseCase.js";
import { IssueNumber } from "../../../src/domain/value-objects/IssueNumber.js";
import { WorkflowError } from "../../../src/domain/errors/WorkflowError.js";

const READY_LABEL = "ai-scrum:issue:status:ready";
const IN_PROGRESS_LABEL = "ai-scrum:issue:status:in-progress";

const validBody = `### タスク概要

Implement feature X.

### 要件

- Requirement 1

### 受け入れ条件

- Acceptance criterion 1
`;

function makeIssueGateway(labels: string[]) {
  return {
    fetchIssue: mock.fn(async () => ({
      title: "Test task",
      body: validBody,
      labels: labels.map((name) => ({ name })),
    })),
    updateLabels: mock.fn(async () => {}),
  };
}

const silentLogger = {
  step: mock.fn(),
  info: mock.fn(),
  error: mock.fn(),
};

describe("ParseIssueUseCase", () => {
  it("succeeds when issue has the ready label", async () => {
    const issueGateway = makeIssueGateway([READY_LABEL]);
    const useCase = new ParseIssueUseCase(issueGateway as never, silentLogger, {
      ready: READY_LABEL,
      inProgress: IN_PROGRESS_LABEL,
    });

    const issue = await useCase.execute(IssueNumber.create(1));

    assert.equal(issue.title, "Test task");
    assert.equal(issueGateway.updateLabels.mock.callCount(), 1);
  });

  it("throws WorkflowError when issue has no ready label", async () => {
    const issueGateway = makeIssueGateway(["some-other-label"]);
    const useCase = new ParseIssueUseCase(issueGateway as never, silentLogger, {
      ready: READY_LABEL,
      inProgress: IN_PROGRESS_LABEL,
    });

    await assert.rejects(
      () => useCase.execute(IssueNumber.create(42)),
      (err) => {
        assert.ok(err instanceof WorkflowError);
        assert.ok(err.message.includes(READY_LABEL));
        return true;
      },
    );

    // updateLabels should NOT have been called
    assert.equal(issueGateway.updateLabels.mock.callCount(), 0);
  });

  it("throws WorkflowError when issue has no labels at all", async () => {
    const issueGateway = makeIssueGateway([]);
    const useCase = new ParseIssueUseCase(issueGateway as never, silentLogger, {
      ready: READY_LABEL,
      inProgress: IN_PROGRESS_LABEL,
    });

    await assert.rejects(
      () => useCase.execute(IssueNumber.create(7)),
      WorkflowError,
    );

    assert.equal(issueGateway.updateLabels.mock.callCount(), 0);
  });
});
