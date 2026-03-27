import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { TaskWorkflowOrchestrator } from "../../../src/application/TaskWorkflowOrchestrator.js";
import { IssueNumber } from "../../../src/domain/value-objects/IssueNumber.js";
import { BranchName } from "../../../src/domain/value-objects/BranchName.js";
import type { TaskIssue } from "../../../src/domain/entities/TaskIssue.js";
import type { DesignAndImplementation } from "../../../src/domain/entities/DesignAndImplementation.js";
import type { ReviewResult } from "../../../src/domain/entities/ReviewResult.js";
import type { PullRequest } from "../../../src/domain/entities/PullRequest.js";

const mockIssue: TaskIssue = {
  number: IssueNumber.create(1),
  title: "Test task",
  description: "Test description",
  requirements: ["req1"],
  acceptanceCriteria: ["ac1"],
  labels: ["task"],
};

const mockDesign: DesignAndImplementation = {
  approach: "TDD",
  targetFiles: [],
  testStrategy: "unit tests",
  designMarkdown: "# Design",
  branch: BranchName.create("task/1-test-task"),
  changedFiles: ["src/test.ts"],
  diffStat: "1 file changed",
  testResults: { passed: true, summary: "All passed" },
  commitHash: "abc123",
};

const mockReview: ReviewResult = {
  approved: true,
  findings: [],
  fixesApplied: [],
  summary: "LGTM",
};

const mockPR: PullRequest = {
  number: 10,
  url: "https://github.com/test/repo/pull/10",
  title: "feat(#1): Test task",
  branch: BranchName.create("task/1-test-task"),
};

describe("TaskWorkflowOrchestrator", () => {
  it("executes all phases in order", async () => {
    const callOrder: string[] = [];

    const parseIssue = {
      execute: mock.fn(async () => {
        callOrder.push("parseIssue");
        return mockIssue;
      }),
    };
    const designAndImplement = {
      execute: mock.fn(async () => {
        callOrder.push("designAndImplement");
        return mockDesign;
      }),
    };
    const review = {
      execute: mock.fn(async () => {
        callOrder.push("review");
        return mockReview;
      }),
    };
    const createPR = {
      execute: mock.fn(async () => {
        callOrder.push("createPR");
        return mockPR;
      }),
    };
    const gitGateway = {
      getRepoStructure: mock.fn(async () => "README.md"),
    };
    const logger = {
      step: mock.fn(),
      info: mock.fn(),
      error: mock.fn(),
    };

    const orchestrator = new TaskWorkflowOrchestrator(
      parseIssue as never,
      designAndImplement as never,
      review as never,
      createPR as never,
      gitGateway as never,
      logger,
    );

    await orchestrator.execute(IssueNumber.create(1));

    assert.deepEqual(callOrder, [
      "parseIssue",
      "designAndImplement",
      "review",
      "createPR",
    ]);
    assert.equal(parseIssue.execute.mock.callCount(), 1);
    assert.equal(designAndImplement.execute.mock.callCount(), 1);
    assert.equal(review.execute.mock.callCount(), 1);
    assert.equal(createPR.execute.mock.callCount(), 1);
    assert.equal(logger.step.mock.callCount(), 4);
  });
});
