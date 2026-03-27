import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IssueNumber } from "../../../src/domain/value-objects/IssueNumber.js";
import { BranchName } from "../../../src/domain/value-objects/BranchName.js";
import { CommitMessage } from "../../../src/domain/value-objects/CommitMessage.js";
import { WorkflowError } from "../../../src/domain/errors/WorkflowError.js";

describe("IssueNumber", () => {
  it("creates a valid issue number", () => {
    const num = IssueNumber.create(23);
    assert.equal(num.value, 23);
  });

  it("rejects zero", () => {
    assert.throws(() => IssueNumber.create(0), WorkflowError);
  });

  it("rejects negative numbers", () => {
    assert.throws(() => IssueNumber.create(-1), WorkflowError);
  });

  it("rejects non-integers", () => {
    assert.throws(() => IssueNumber.create(1.5), WorkflowError);
  });

  it("formats with # prefix", () => {
    assert.equal(IssueNumber.create(23).toString(), "#23");
  });
});

describe("BranchName", () => {
  it("generates branch name from issue", () => {
    const branch = BranchName.fromIssueNumber(23, "Add user authentication");
    assert.equal(branch.value, "task/23-add-user-authentication");
  });

  it("truncates long titles", () => {
    const branch = BranchName.fromIssueNumber(
      1,
      "This is a very long title that should be truncated to a reasonable length for branch names",
    );
    assert.ok(branch.value.length <= 55);
  });

  it("handles special characters", () => {
    const branch = BranchName.fromIssueNumber(5, "Fix: bug #123 (urgent!)");
    assert.match(branch.value, /^task\/5-[a-z0-9-]+$/);
  });

  it("validates branch name on create", () => {
    const branch = BranchName.create("feature/test");
    assert.equal(branch.value, "feature/test");
  });

  it("rejects invalid characters", () => {
    assert.throws(
      () => BranchName.create("branch with spaces"),
      WorkflowError,
    );
  });
});

describe("CommitMessage", () => {
  it("creates conventional commit for task", () => {
    const msg = CommitMessage.forTask(23, "add login form");
    assert.equal(msg.value, "feat(#23): add login form");
  });

  it("strips newlines from summary", () => {
    const msg = CommitMessage.forTask(1, "line1\nline2");
    assert.equal(msg.value, "feat(#1): line1 line2");
  });

  it("rejects empty summary", () => {
    assert.throws(() => CommitMessage.forTask(1, ""), WorkflowError);
  });

  it("creates from string", () => {
    const msg = CommitMessage.create("fix: something");
    assert.equal(msg.value, "fix: something");
  });

  it("rejects empty string", () => {
    assert.throws(() => CommitMessage.create("  "), WorkflowError);
  });
});
