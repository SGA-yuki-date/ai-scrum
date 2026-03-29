import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { ILogger } from "../../application/ports/ILogger.js";

/**
 * コンソールとファイルの両方にログを出力するロガー。
 */
export class TeeLogger implements ILogger {
  constructor(private readonly filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    // 実行ごとにファイルをリセット
    writeFileSync(filePath, "", "utf-8");
  }

  private append(line: string): void {
    appendFileSync(this.filePath, line + "\n", "utf-8");
  }

  step(phase: string, message: string): void {
    const sep = `[${"=".repeat(40)}]`;
    const lines = [`\n${sep}`, `[Phase ${phase}] ${message}`, `${sep}\n`];
    for (const line of lines) {
      console.log(line);
      this.append(line);
    }
  }

  info(message: string): void {
    const line = `  ℹ ${message}`;
    console.log(line);
    this.append(line);
  }

  error(message: string, error?: Error): void {
    const line = `  ✖ ${message}`;
    console.error(line);
    this.append(line);
    if (error?.stack) {
      const stackLine = `    ${error.stack}`;
      console.error(stackLine);
      this.append(stackLine);
    }
  }
}
