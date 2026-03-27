import { parseArgs } from "node:util";
import { createWorkflow } from "../../composition.js";
import { createDefaultConfig } from "../config/WorkflowConfig.js";
import { IssueNumber } from "../../domain/value-objects/IssueNumber.js";
import { WorkflowError } from "../../domain/errors/WorkflowError.js";

export async function runCli(argv: string[]): Promise<void> {
  const subcommand = argv[0];

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    printUsage();
    process.exit(subcommand ? 0 : 1);
  }

  if (subcommand !== "task") {
    console.error(`Unknown command: ${subcommand}`);
    printUsage();
    process.exit(1);
  }

  const { values, positionals } = parseArgs({
    args: argv.slice(1),
    options: {
      "ai-timeout": { type: "string" },
      "base-branch": { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  const issueNumberRaw = positionals[0];
  if (!issueNumberRaw) {
    console.error("Error: Issue number is required.");
    printUsage();
    process.exit(1);
  }

  const issueNumber = IssueNumber.create(parseInt(issueNumberRaw, 10));

  const config = createDefaultConfig({
    aiTimeout: values["ai-timeout"]
      ? Number(values["ai-timeout"])
      : undefined,
    baseBranch: values["base-branch"] ?? undefined,
  });

  const orchestrator = createWorkflow(config);

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
  ai-scrum task <issueNumber> [options]

Options:
  --ai-timeout <ms>      AI timeout in ms (default: 600000)
  --base-branch <branch> Base branch (default: "main")
  -h, --help             Show this help message
`);
}
