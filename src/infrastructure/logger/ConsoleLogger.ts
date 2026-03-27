import type { ILogger } from "../../application/ports/ILogger.js";

export class ConsoleLogger implements ILogger {
  step(phase: string, message: string): void {
    console.log(`\n[${"=".repeat(40)}]`);
    console.log(`[Phase ${phase}] ${message}`);
    console.log(`[${"=".repeat(40)}]\n`);
  }

  info(message: string): void {
    console.log(`  ℹ ${message}`);
  }

  error(message: string, error?: Error): void {
    console.error(`  ✖ ${message}`);
    if (error?.stack) {
      console.error(`    ${error.stack}`);
    }
  }
}
