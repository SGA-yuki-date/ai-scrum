import { parseArgs } from "node:util";
import { createWorkflow } from "../../composition.js";
import { createDefaultConfig } from "../config/WorkflowConfig.js";
import { IssueNumber } from "../../domain/value-objects/IssueNumber.js";
import { WorkflowError } from "../../domain/errors/WorkflowError.js";
import { bashExec } from "../../infrastructure/shell/BashRunner.js";
import { PickNextIssueUseCase } from "../../application/usecases/PickNextIssueUseCase.js";
import { GhCliIssueGateway } from "../../infrastructure/github/GhCliIssueGateway.js";
import { ConsoleLogger } from "../../infrastructure/logger/ConsoleLogger.js";

export async function runCli(argv: string[]): Promise<void> {
  const subcommand = argv[0];

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    printUsage();
    process.exit(subcommand ? 0 : 1);
  }

  if (subcommand !== "task" && subcommand !== "setup-labels") {
    console.error(`Unknown command: ${subcommand}`);
    printUsage();
    process.exit(1);
  }

  if (subcommand === "setup-labels") {
    await runSetupLabels();
    return;
  }

  const { values, positionals } = parseArgs({
    args: argv.slice(1),
    options: {
      "ai-timeout": { type: "string" },
      "base-branch": { type: "string" },
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  const config = createDefaultConfig({
    aiTimeout: values["ai-timeout"]
      ? Number(values["ai-timeout"])
      : undefined,
    baseBranch: values["base-branch"] ?? undefined,
  });

  const issueNumberRaw = positionals[0];
  let issueNumber: IssueNumber;

  if (issueNumberRaw) {
    issueNumber = IssueNumber.create(parseInt(issueNumberRaw, 10));
  } else {
    const logger = new ConsoleLogger();
    const issueGateway = new GhCliIssueGateway();
    const pickNext = new PickNextIssueUseCase(
      issueGateway,
      logger,
      config.labels.ready,
    );
    const picked = await pickNext.execute();
    if (!picked) {
      console.log("No ready issues found. Nothing to do.");
      process.exit(0);
    }
    if (values["dry-run"]) {
      console.log(`Next issue: #${picked.number} "${picked.title}"`);
      process.exit(0);
    }
    issueNumber = IssueNumber.create(picked.number);
  }

  const orchestrator = createWorkflow(config, issueNumber.value);

  try {
    await orchestrator.execute(issueNumber);
  } catch (error) {
    if (error instanceof WorkflowError) {
      console.error(
        `\nWorkflow error [${error.phase ?? "unknown"}]: ${error.message}`,
      );
    } else {
      console.error(
        `\nUnexpected error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    process.exit(1);
  }
}

function printUsage(): void {
  console.log(`
ai-scrum - AI-powered Scrum workflow

Usage:
  ai-scrum task [issueNumber] [options]
  ai-scrum setup-labels

Commands:
  task           Run task workflow (auto-picks highest priority ready issue if no number given)
  setup-labels   Create required GitHub labels in the current repository

Options:
  --ai-timeout <ms>      AI timeout in ms (default: 600000)
  --base-branch <branch> Base branch (default: "main")
  --dry-run              Show which issue would be picked without executing
  -h, --help             Show this help message
`);
}

const LABELS: { name: string; color: string; description: string }[] = [
  { name: "ai-scrum:issue:status:ready", color: "0E8A16", description: "実装着手可能" },
  { name: "ai-scrum:issue:status:in-progress", color: "FBCA04", description: "実装中" },
  { name: "ai-scrum:issue:status:in-review", color: "1D76DB", description: "レビュー中" },
  { name: "ai-scrum:issue:priority:P0-immediately", color: "B60205", description: "優先度: 最優先（即時対応）" },
  { name: "ai-scrum:issue:priority:P1-high", color: "D93F0B", description: "優先度: 高" },
  { name: "ai-scrum:issue:priority:P2-medium", color: "FBCA04", description: "優先度: 中" },
  { name: "ai-scrum:issue:priority:P3-low", color: "0E8A16", description: "優先度: 低" },
];

async function runSetupLabels(): Promise<void> {
  console.log("\nai-scrum: ラベルをセットアップします\n");
  for (const label of LABELS) {
    try {
      await bashExec("gh", [
        "label", "create", label.name,
        "--color", label.color,
        "--description", label.description,
      ]);
      console.log(`  \u2714 作成: ${label.name}`);
    } catch {
      console.log(`  - スキップ: ${label.name}（既に存在）`);
    }
  }
  console.log("\n完了しました");
}
