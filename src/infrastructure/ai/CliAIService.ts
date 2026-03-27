import { spawn } from "node:child_process";
import type { IAIService } from "../../application/ports/IAIService.js";
import { WorkflowError } from "../../domain/errors/WorkflowError.js";

export class CliAIService implements IAIService {
  constructor(
    private readonly command: string,
    private readonly timeout: number,
  ) {}

  async invoke(promptContent: string, workingDir: string): Promise<string> {
    const [cmd, ...args] = this.command.split(/\s+/);
    if (!cmd) {
      throw new WorkflowError("AI command is not configured.", "ai-service");
    }

    return new Promise<string>((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd: workingDir,
        timeout: this.timeout,
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      child.on("error", (error) => {
        reject(
          new WorkflowError(
            `AI service failed to start: ${error.message}`,
            "ai-service",
          ),
        );
      });

      child.on("close", (code) => {
        if (code !== 0) {
          reject(
            new WorkflowError(
              `AI service exited with code ${code}: ${stderr}`,
              "ai-service",
            ),
          );
        } else {
          resolve(stdout);
        }
      });

      child.stdin.write(promptContent);
      child.stdin.end();
    });
  }
}
