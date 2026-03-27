#!/usr/bin/env node
import { runCli } from "./adapter/cli/TaskWorkflowCommand.js";

runCli(process.argv.slice(2));
