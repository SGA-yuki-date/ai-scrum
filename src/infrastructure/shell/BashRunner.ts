import {
  execFile,
  spawn,
  type ChildProcess,
  type SpawnOptions,
} from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * bash 用のシングルクォートエスケープ。
 * 引数をシングルクォートで囲み、内部のシングルクォートは '\'' で安全にエスケープする。
 */
function shellEscape(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * bash -c 経由でコマンドを実行し、stdout/stderr を返す。
 * Windows でも Git Bash が PATH に存在すれば動作する。
 */
export async function bashExec(
  cmd: string,
  args: string[],
  options?: { cwd?: string },
): Promise<{ stdout: string; stderr: string }> {
  const command = [cmd, ...args.map(shellEscape)].join(" ");
  const result = await execFileAsync("bash", ["-c", command], {
    ...options,
    encoding: "utf-8",
  });
  return { stdout: result.stdout, stderr: result.stderr };
}

/**
 * bash -c 経由でコマンドをストリーミング実行する（spawn 互換）。
 */
export function bashSpawn(
  cmd: string,
  args: string[],
  options: Omit<SpawnOptions, "shell">,
): ChildProcess {
  const command = [cmd, ...args.map(shellEscape)].join(" ");
  return spawn("bash", ["-c", command], options);
}
