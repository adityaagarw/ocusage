#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { sessionReport, dailyReport, weeklyReport, monthlyReport, hourlyReport, liveReport } from "./reports";
import os from "os";
import path from "path";

const commonDateOptions = {
  "since": {
    type: "string",
    description: "Start date for the report (YYYY-MM-DD)",
  },
  "until": {
    type: "string",
    description: "End date for the report (YYYY-MM-DD)",
  },
  
};

const commonReportOptions = {
  "json": {
    type: "boolean",
    description: "Output report in JSON format",
    default: false,
  },
  "show-models": {
    type: "boolean",
    description: "Show detailed model breakdown in reports",
    default: true,
  },
  "xml": {
    type: "boolean",
    description: "Output report in XML format (overrides --json)",
    default: false,
  },
};

const commonOptions = {
  "data-dir": {
    type: "string",
    description: "Specify the data directory for opencode usage files",
    default: path.join(os.homedir(), ".local", "share", "opencode", "project"), // Default based on data.ts analysis
  },
};

yargs(hideBin(process.argv))
  .options(commonOptions) // Apply global options
  .options(commonDateOptions) // Apply global date options
  .options(commonReportOptions) // Apply global report options
  .command(
    "session",
    "Generate a report of opencode session usage.",
    (yargs) => {
      // No need to return yargs.options(...) here anymore
      return yargs; // Just return yargs
    },
    async (argv) => {
      await sessionReport(argv.since as string, argv.until as string, argv.json as boolean, argv.showModels as boolean, argv.xml as boolean, argv.dataDir as string);
    }
  )
  .command(
    "daily",
    "Generate a daily report of opencode usage.",
    (yargs) => {
      return yargs;
    },
    async (argv) => {
      await dailyReport(argv.since as string, argv.until as string, argv.json as boolean, argv.showModels as boolean, argv.xml as boolean, argv.dataDir as string);
    }
  )
  .command(
    "weekly",
    "Generate a weekly report of opencode usage.",
    (yargs) => {
      return yargs;
    },
    async (argv) => {
      await weeklyReport(argv.since as string, argv.until as string, argv.json as boolean, argv.showModels as boolean, argv.xml as boolean, argv.dataDir as string);
    }
  )
  .command(
    "monthly",
    "Generate a monthly report of opencode usage.",
    (yargs) => {
      return yargs;
    },
    async (argv) => {
      await monthlyReport(argv.since as string, argv.until as string, argv.json as boolean, argv.showModels as boolean, argv.xml as boolean, argv.dataDir as string);
    }
  )
  .command(
    "hourly",
    "Generate an hourly report of opencode usage.",
    (yargs) => {
      return yargs;
    },
    async (argv) => {
      await hourlyReport(argv.since as string, argv.until as string, argv.json as boolean, argv.showModels as boolean, argv.xml as boolean, argv.dataDir as string);
    }
  )
  .command(
    "today",
    "Generate a report for today's opencode usage.",
    (yargs) => {
      return yargs;
    },
    async (argv) => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayFormatted = `${year}-${month}-${day}`;
      await dailyReport(todayFormatted, todayFormatted, argv.json as boolean, argv.showModels as boolean, argv.xml as boolean, argv.dataDir as string);
    }
  )
  .command(
    "live",
    "(experimental) Monitor opencode usage in real-time.",
    (yargs) => {
      return yargs; // live command also uses common options
    },
    async (argv) => {
      await liveReport(argv.showModels as boolean, argv.json as boolean, argv.xml as boolean, argv.dataDir as string);
    }
  )
  .demandCommand(1, "You need at least one command before moving on")
  .help()
  .alias("h", "help")
  .parse();