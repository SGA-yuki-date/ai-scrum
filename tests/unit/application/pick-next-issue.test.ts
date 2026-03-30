import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { PickNextIssueUseCase } from "../../../src/application/usecases/PickNextIssueUseCase.js";

const silentLogger = {
  step: mock.fn(),
  info: mock.fn(),
  error: mock.fn(),
};

function makeIssueGateway(issues: Array<{ number: number; title: string; labels: string[] }>) {
  return {
    fetchIssue: mock.fn(async () => ({ title: "", body: "", labels: [] })),
    listReadyIssues: mock.fn(async () => issues),
    updateLabels: mock.fn(async () => {}),
  };
}

describe("PickNextIssueUseCase", () => {
  it("returns undefined when no ready issues exist", async () => {
    const gateway = makeIssueGateway([]);
    const useCase = new PickNextIssueUseCase(gateway as never, silentLogger, "ai-scrum:issue:status:ready");

    const result = await useCase.execute();

    assert.equal(result, undefined);
  });

  it("picks the single available issue", async () => {
    const gateway = makeIssueGateway([
      { number: 5, title: "Task A", labels: ["ai-scrum:issue:status:ready"] },
    ]);
    const useCase = new PickNextIssueUseCase(gateway as never, silentLogger, "ai-scrum:issue:status:ready");

    const result = await useCase.execute();

    assert.equal(result?.number, 5);
  });

  it("picks higher priority issue (P0 over P2)", async () => {
    const gateway = makeIssueGateway([
      { number: 1, title: "Low prio", labels: ["ai-scrum:issue:priority:P2-medium"] },
      { number: 2, title: "High prio", labels: ["ai-scrum:issue:priority:P0-immediately"] },
    ]);
    const useCase = new PickNextIssueUseCase(gateway as never, silentLogger, "ai-scrum:issue:status:ready");

    const result = await useCase.execute();

    assert.equal(result?.number, 2);
  });

  it("picks lower issue number when same priority", async () => {
    const gateway = makeIssueGateway([
      { number: 10, title: "Task B", labels: ["ai-scrum:issue:priority:P1-high"] },
      { number: 3, title: "Task A", labels: ["ai-scrum:issue:priority:P1-high"] },
    ]);
    const useCase = new PickNextIssueUseCase(gateway as never, silentLogger, "ai-scrum:issue:status:ready");

    const result = await useCase.execute();

    assert.equal(result?.number, 3);
  });

  it("prioritizes labeled issues over unlabeled ones", async () => {
    const gateway = makeIssueGateway([
      { number: 1, title: "No prio", labels: [] },
      { number: 5, title: "Has prio", labels: ["ai-scrum:issue:priority:P3-low"] },
    ]);
    const useCase = new PickNextIssueUseCase(gateway as never, silentLogger, "ai-scrum:issue:status:ready");

    const result = await useCase.execute();

    assert.equal(result?.number, 5);
  });

  it("sorts by full priority ladder then issue number", async () => {
    const gateway = makeIssueGateway([
      { number: 100, title: "P3", labels: ["ai-scrum:issue:priority:P3-low"] },
      { number: 2, title: "P1-a", labels: ["ai-scrum:issue:priority:P1-high"] },
      { number: 50, title: "None", labels: [] },
      { number: 1, title: "P1-b", labels: ["ai-scrum:issue:priority:P1-high"] },
      { number: 10, title: "P0", labels: ["ai-scrum:issue:priority:P0-immediately"] },
    ]);
    const useCase = new PickNextIssueUseCase(gateway as never, silentLogger, "ai-scrum:issue:status:ready");

    const result = await useCase.execute();

    // P0 (#10) should be picked first
    assert.equal(result?.number, 10);
  });
});
