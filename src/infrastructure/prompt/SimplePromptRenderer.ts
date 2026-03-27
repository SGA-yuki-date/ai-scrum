import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { IPromptRenderer } from "../../application/ports/IPromptRenderer.js";

export class SimplePromptRenderer implements IPromptRenderer {
  constructor(private readonly templateDir: string) {}

  async render(
    templateName: string,
    context: Record<string, unknown>,
  ): Promise<string> {
    const templatePath = join(
      this.templateDir,
      `${templateName}.prompt.md`,
    );
    let template = await readFile(templatePath, "utf-8");

    template = template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const value = context[key];
      if (value === undefined || value === null) return "";
      return String(value);
    });

    return template;
  }
}
