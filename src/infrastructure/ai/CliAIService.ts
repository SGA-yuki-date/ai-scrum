import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import type { IAIService } from "../../application/ports/IAIService.js";
import type { ILogger } from "../../application/ports/ILogger.js";
import { WorkflowError } from "../../domain/errors/WorkflowError.js";
import { bashSpawn } from "../shell/BashRunner.js";

export class CliAIService implements IAIService {
  constructor(
    private readonly command: string,
    private readonly timeout: number,
    private readonly logger?: ILogger,
  ) {}

  async invoke(promptContent: string, workingDir: string): Promise<string> {
    const [cmd, ...baseArgs] = this.command.split(/\s+/);
    if (!cmd) {
      throw new WorkflowError("AI command is not configured.", "ai-service");
    }

    // プロンプトを一時ファイルに書き出し、コマンドライン引数の破損を回避
    const tmpFile = join(
      tmpdir(),
      `ai-scrum-prompt-${randomBytes(8).toString("hex")}.md`,
    );
    writeFileSync(tmpFile, promptContent, "utf-8");
    this.logger?.info(`  [AI:info] Prompt written to temp file: ${tmpFile}`);

    // 一時ファイルパスを読み込む指示に差し替え
    const fileReadInstruction = `Read the file at "${tmpFile}" and follow all instructions contained within it.`;
    const args = [...baseArgs, fileReadInstruction];

    return new Promise<string>((resolve, reject) => {
      const cleanup = () => {
        try {
          unlinkSync(tmpFile);
        } catch {
          // 削除失敗は無視
        }
      };

      const child = bashSpawn(cmd, args, {
        cwd: workingDir,
        // timeout は自前管理するため spawn には渡さない
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });

      // spawn の timeout オプションに依存せず、自前フラグで確実に判定する
      let killedByTimeout = false;
      const timeoutHandle = setTimeout(() => {
        killedByTimeout = true;
        this.logger?.info(
          `  [AI:info] タイムアウト (${this.timeout}ms) に達したためプロセスを終了します。`,
        );
        child.kill("SIGTERM");
        // SIGTERM で終了しない場合に備えて SIGKILL を送る
        setTimeout(() => child.kill("SIGKILL"), 5_000);
      }, this.timeout);

      let stdout = "";
      let stderr = "";
      let lineBuffer = "";

      child.stdout?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        // ストリーミング出力: 行単位でログ表示
        lineBuffer += chunk;
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.trim()) {
            this.logger?.info(`  [AI] ${line}`);
          }
        }
      });

      child.stderr?.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        // stderr もリアルタイム表示（gh copilot は統計情報を stderr に出力する）
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.trim()) {
            this.logger?.info(`  [AI:info] ${line}`);
          }
        }
      });

      child.on("error", (error) => {
        clearTimeout(timeoutHandle);
        reject(
          new WorkflowError(
            `AI service failed to start: ${error.message}`,
            "ai-service",
          ),
        );
      });

      child.on("close", (code) => {
        clearTimeout(timeoutHandle);
        // 残りのバッファをフラッシュ
        if (lineBuffer.trim()) {
          this.logger?.info(`  [AI] ${lineBuffer}`);
        }
        cleanup();
        if (killedByTimeout) {
          reject(
            new WorkflowError(
              `AI service timed out after ${this.timeout}ms`,
              "ai-service",
              true,
            ),
          );
        } else if (code !== 0) {
          reject(
            new WorkflowError(
              `AI service exited with code ${code}: ${stderr}`,
              "ai-service",
              false,
            ),
          );
        } else {
          resolve(stdout);
        }
      });

    });
  }
}
