import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SimplePromptRenderer } from "../../../src/infrastructure/prompt/SimplePromptRenderer.js";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("SimplePromptRenderer", () => {
  const testDir = join(tmpdir(), "ai-scrum-test-prompts");

  it("replaces template variables", async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(
      join(testDir, "test.prompt.md"),
      "Hello {{name}}, your task is {{task}}.",
    );

    const renderer = new SimplePromptRenderer(testDir);
    const result = await renderer.render("test", {
      name: "World",
      task: "build",
    });

    assert.equal(result, "Hello World, your task is build.");
    await rm(testDir, { recursive: true, force: true });
  });

  it("replaces missing variables with empty string", async () => {
    await mkdir(testDir, { recursive: true });
    await writeFile(
      join(testDir, "missing.prompt.md"),
      "Value: {{missing}}.",
    );

    const renderer = new SimplePromptRenderer(testDir);
    const result = await renderer.render("missing", {});

    assert.equal(result, "Value: .");
    await rm(testDir, { recursive: true, force: true });
  });
});
