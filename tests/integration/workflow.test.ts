import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { TaskWorkflowOrchestrator } from "../../src/application/TaskWorkflowOrchestrator.js";
import { IssueNumber } from "../../src/domain/value-objects/IssueNumber.js";
import { BranchName } from "../../src/domain/value-objects/BranchName.js";

describe("Workflow Integration (mocked infrastructure)", () => {
  it("completes full workflow with mocked infrastructure", async () => {
    const mockIssue = {
      number: IssueNumber.create(23),
      title: "Add feature X",
      description: "Implement feature X",
      requirements: ["Must do X", "Must do Y"],
      acceptanceCriteria: ["X works", "Y works"],
      labels: ["task"],
    };

    const mockDesign = {
      branch: BranchName.create("task/23-add-feature-x"),
      changedFiles: ["src/feature.ts"],
      diffStat: "1 file changed, 50 insertions(+)",
      commitHash: "abc123def",
    };

    const mockReview = {
      approved: true,
      summary: "Code looks good. All acceptance criteria met.",
    };

    const mockPR = {
      number: 100,
      url: "https://github.com/test/repo/pull/100",
      title: "feat(#23): Add feature X",
      branch: BranchName.create("task/23-add-feature-x"),
    };

    const parseIssue = { execute: mock.fn(async () => mockIssue) };
    const designAndImplement = { execute: mock.fn(async () => mockDesign) };
    const review = { execute: mock.fn(async () => mockReview) };
    const createPR = { execute: mock.fn(async () => mockPR) };
    const gitGateway = {
      getRepoStructure: mock.fn(async () => "README.md\nsrc/index.ts"),
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

    await orchestrator.execute(IssueNumber.create(23));

    assert.equal(parseIssue.execute.mock.callCount(), 1);
    assert.equal(designAndImplement.execute.mock.callCount(), 1);
    assert.equal(review.execute.mock.callCount(), 1);
    assert.equal(createPR.execute.mock.callCount(), 1);
    assert.equal(logger.step.mock.callCount(), 4);
  });
});
