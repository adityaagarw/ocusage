import { listSessionInfoFiles, readSessionInfo, listMessageFiles, readMessage, MessageInfo, getSessionDataDirs } from "./data";
import Table from "cli-table3";
import chokidar from "chokidar";

interface ModelAggregatedData {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

interface AggregatedData {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  models: { [modelID: string]: ModelAggregatedData };
}

function aggregateMessage(aggregated: AggregatedData, message: MessageInfo) {
  if (message.role === "assistant" && message.tokens && typeof message.tokens === 'object' && message.
    tokens !== null) {
    const modelID = message.modelID || "unknown";
   
    // Safely get token values, defaulting to 0 if undefined or null
    const inputTokens = Number(message.tokens.input ?? 0);
    const outputTokens = Number(message.tokens.output ?? 0);
    const cacheReadTokens = Number(message.tokens.cache?.read ?? 0);
    const cacheWriteTokens = Number(message.tokens.cache?.write ?? 0);
   
    // Aggregate total usage
    aggregated.totalCost += Number(message.cost);
    aggregated.totalInputTokens += inputTokens;
    aggregated.totalOutputTokens += outputTokens;
    aggregated.totalCacheReadTokens += cacheReadTokens;
    aggregated.totalCacheWriteTokens += cacheWriteTokens;
   
    // Aggregate per-model usage
    if (!aggregated.models[modelID]) {
      aggregated.models[modelID] = { cost: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
      cacheWriteTokens: 0 };
    }
    aggregated.models[modelID].cost += Number(message.cost);
    aggregated.models[modelID].inputTokens += inputTokens;
    aggregated.models[modelID].outputTokens += outputTokens;
    aggregated.models[modelID].cacheReadTokens += cacheReadTokens;
    aggregated.models[modelID].cacheWriteTokens += cacheWriteTokens;
  }
}

function getFormattedDate(timestamp: number, format: "day" | "month" | "week" | "hour" | "minute"): string {
  const date = new Date(timestamp);
  switch (format) {
    case "day":
      return date.toISOString().split('T')[0]; // YYYY-MM-DD
    case "month":
      return date.toISOString().substring(0, 7); // YYYY-MM
    case "week":
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      const dayOfWeek = date.getDay(); // 0 for Sunday, 1 for Monday, etc.

      // Get the first day of the week (Monday)
      const firstDayOfWeek = new Date(year, month, day - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
      // Get the last day of the week (Sunday)
      const lastDayOfWeek = new Date(year, month, firstDayOfWeek.getDate() + 6);

      return `${firstDayOfWeek.toISOString().split('T')[0]} to ${lastDayOfWeek.toISOString().split('T')[0]}`;
    case "hour":
      return date.toISOString().substring(0, 13); // YYYY-MM-DDTHH
    case "minute":
      return date.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
    default:
      return date.toISOString();
  }
}

function isWithinDateTimeRange(timestamp: number, since?: string, until?: string, startTime?: string, endTime?: string): boolean {
  const date = new Date(timestamp);
  let startDateTime: Date | undefined;
  let endDateTime: Date | undefined;

  if (since) {
    startDateTime = new Date(since);
    if (startTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      startDateTime.setHours(hours, minutes, 0, 0);
    }
  }

  if (until) {
    endDateTime = new Date(until);
    if (endTime) {
      const [hours, minutes] = endTime.split(':').map(Number);
      endDateTime.setHours(hours, minutes, 59, 999);
    } else {
      endDateTime.setHours(23, 59, 59, 999); // End of the day if no end time specified
    }
  }

  if (startDateTime && date < startDateTime) {
    return false;
  }
  if (endDateTime && date > endDateTime) {
    return false;
  }
  return true;
}

function generateXmlOutput(data: any, rootElement: string): string {
  let xml = `<${rootElement}>`;
  if (Array.isArray(data)) {
    data.forEach(item => {
      xml += `<item>`;
      for (const key in item) {
        if (item.hasOwnProperty(key)) {
          if (typeof item[key] === 'object' && item[key] !== null) {
            xml += `<${key}>${generateXmlOutput(item[key], key)}</${key}>`;
          } else {
            xml += `<${key}>${item[key]}</${key}>`;
          }
        }
      }
      xml += `</item>`;
    });
  } else if (typeof data === 'object' && data !== null) {
    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        if (typeof data[key] === 'object' && data[key] !== null) {
          xml += `<${key}>${generateXmlOutput(data[key], key)}</${key}>`;
        } else {
          xml += `<${key}>${data[key]}</${key}>`;
        }
      }
    }
  } else {
    xml += data;
  }
  xml += `</${rootElement}>`;
  return xml;
}

export async function sessionReport(since?: string, until?: string, jsonOutput: boolean = false, showModels: boolean = true, xmlOutput: boolean = false, dataDir?: string) {

  let sessionFiles;
  try {
    sessionFiles = await listSessionInfoFiles(dataDir);
  } catch (error: any) {
    if (jsonOutput) {
      console.log('[]');
    } else {
      console.error(`Error: ${error.message}`);
      console.error('\nTo use ocusage, you need opencode installed and some usage data generated.');
      console.error('Visit: https://github.com/sst/opencode for installation instructions.');
    }
    return;
  }

  if (sessionFiles.length === 0) {
    const message = 'No opencode session data found.';
    if (jsonOutput) {
      console.log('[]');
    } else if (xmlOutput) {
      console.log('<?xml version="1.0" encoding="UTF-8"?>\n<sessions>\n  <message>No sessions found</message>\n</sessions>');
    } else {
      console.log(message);
      console.log('\nTo generate session data:');
      console.log('1. Install opencode: https://github.com/sst/opencode');
      console.log('2. Use opencode to generate some coding sessions');
      console.log('3. Run ocusage session to see your session statistics');
    }
    return;
  }

  const sessionsData: any[] = [];

  for (const sessionFile of sessionFiles) {
    try {
      const sessionInfo = sessionFile.info;
      const sessionDataDir = sessionFile.sessionDataDir;
      // Filter sessions based on creation date
      if (!isWithinDateTimeRange(sessionInfo.time.created, since, until)) {
        continue;
      }

      const messageFiles = await listMessageFiles(sessionInfo.id, sessionDataDir);

      const aggregated: AggregatedData = { totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCacheReadTokens: 0, totalCacheWriteTokens: 0, models: {} };

      for (const messageFilePath of messageFiles) {
        try {
          const message = await readMessage(messageFilePath);
          // Filter messages based on creation date
          if (message.role === "assistant" && message.tokens && isWithinDateTimeRange(message.time.created, since, until)) {
            aggregateMessage(aggregated, message);
          }
        } catch (error) {
          console.warn(`Warning: Could not process message file ${messageFilePath}. Skipping.`, error);
        }
      }
      // Only push to data if there's some usage within the filtered range
      if (aggregated.totalCost > 0 || aggregated.totalInputTokens > 0 || aggregated.totalOutputTokens > 0) {
        const sessionEntry: any = {
        id: sessionInfo.id,
        title: sessionInfo.title,
        created: new Date(sessionInfo.time.created).toLocaleString(),
        totalCost: aggregated.totalCost,
        inputTokens: aggregated.totalInputTokens,
        outputTokens: aggregated.totalOutputTokens,
        cacheReadTokens: aggregated.totalCacheReadTokens,
        cacheWriteTokens: aggregated.totalCacheWriteTokens,
      };
      if (showModels) {
        sessionEntry.models = aggregated.models;
      }
      sessionsData.push(sessionEntry);
      }

    } catch (error) {
      console.warn(`Warning: Could not process session file ${sessionFile.filePath}. Skipping.`, error);
    }
  }

  if (xmlOutput) {
    console.log(generateXmlOutput(sessionsData, "sessions"));
  } else if (jsonOutput) {
    console.log(JSON.stringify(sessionsData, null, 2));
  } else {
    const table = new Table({
      head: ['Session ID', 'Title', 'Created', 'Total Cost', 'Input Tokens', 'Output Tokens', 'Cached Input', 'Cached Output'],
      colWidths: [15, 40, 25, 15, 15, 15, 15, 15], // Adjusted colWidths
      wordWrap: true
    });

    let grandTotalCost = 0;
    let grandTotalInputTokens = 0;
    let grandTotalOutputTokens = 0;
    let grandTotalCacheReadTokens = 0;
    let grandTotalCacheWriteTokens = 0;

    sessionsData.forEach(data => {
      table.push([
        data.id,
        data.title,
        data.created,
        "$ " + String(`${data.totalCost.toFixed(6)}`),
        data.inputTokens,
        data.outputTokens,
        data.cacheReadTokens,
        data.cacheWriteTokens
      ]);

      grandTotalCost += data.totalCost;
      grandTotalInputTokens += data.inputTokens;
      grandTotalOutputTokens += data.outputTokens;
      grandTotalCacheReadTokens += data.cacheReadTokens;
      grandTotalCacheWriteTokens += data.cacheWriteTokens;

      // Add model breakdown rows
      if (showModels) {
        for (const modelID in data.models) {
          const modelData = data.models[modelID];
          table.push([
            '', // Empty for Session ID
            `  Model: ${modelID}`, // Model ID aligned under Title
            '', // Empty for Created
            "$ " + String(`${modelData.cost.toFixed(6)}`),
            modelData.inputTokens,
            modelData.outputTokens,
            modelData.cacheReadTokens,
            modelData.cacheWriteTokens
          ]);
        }
      }
    });

    // Add total row
    table.push([
      'Total',
      '', // Empty for Title
      '', // Empty for Created
      "$ " + String(`${grandTotalCost.toFixed(6)}`),
      grandTotalInputTokens,
      grandTotalOutputTokens,
      grandTotalCacheReadTokens,
      grandTotalCacheWriteTokens
    ]);

    console.log(table.toString());
  }
}

export async function dailyReport(since?: string, until?: string, jsonOutput: boolean = false, showModels: boolean = true, xmlOutput: boolean = false, dataDir?: string) {
  await generateReport("day", since, until, jsonOutput, showModels, xmlOutput, dataDir);
}

export async function weeklyReport(since?: string, until?: string, jsonOutput: boolean = false, showModels: boolean = true, xmlOutput: boolean = false, dataDir?: string) {
  await generateReport("week", since, until, jsonOutput, showModels, xmlOutput, dataDir);
}

export async function monthlyReport(since?: string, until?: string, jsonOutput: boolean = false, showModels: boolean = true, xmlOutput: boolean = false, dataDir?: string) {
  await generateReport("month", since, until, jsonOutput, showModels, xmlOutput, dataDir);
}

export async function hourlyReport(since?: string, until?: string, jsonOutput: boolean = false, showModels: boolean = true, xmlOutput: boolean = false, dataDir?: string) {
  await generateReport("hour", since, until, jsonOutput, showModels, xmlOutput, dataDir);
}

export async function minuteReport(since?: string, until?: string, jsonOutput: boolean = false, showModels: boolean = true, xmlOutput: boolean = false, dataDir?: string) {
  await generateReport("minute", since, until, jsonOutput, showModels, xmlOutput, dataDir);
}

async function generateReport(format: "day" | "month" | "week" | "hour" | "minute", since?: string, until?: string, jsonOutput: boolean = false, showModels: boolean = true, xmlOutput: boolean = false, dataDir?: string) {
  console.log(`Generating ${format === "day" ? "daily" : format + "ly"} report...`);

  let sessionFiles;
  try {
    sessionFiles = await listSessionInfoFiles(dataDir);
  } catch (error: any) {
    if (jsonOutput) {
      console.log('[]');
    } else {
      console.error(`Error: ${error.message}`);
      console.error('\nTo use ocusage, you need opencode installed and some usage data generated.');
      console.error('Visit: https://github.com/sst/opencode for installation instructions.');
    }
    return;
  }

  if (sessionFiles.length === 0) {
    const message = 'No opencode usage data found.';
    if (jsonOutput) {
      console.log('[]');
    } else if (xmlOutput) {
      console.log('<?xml version="1.0" encoding="UTF-8"?>\n<report>\n  <message>No data found</message>\n</report>');
    } else {
      console.log(message);
      console.log('\nTo generate usage data:');
      console.log('1. Install opencode: https://github.com/sst/opencode');
      console.log('2. Use opencode to generate some coding sessions');
      console.log('3. Run ocusage again to see your usage statistics');
    }
    return;
  }

  const aggregatedData: { [key: string]: AggregatedData } = {};

  for (const sessionFile of sessionFiles) {
    try {
      const sessionInfo = sessionFile.info;
      const sessionDataDir = sessionFile.sessionDataDir;
      // Filter sessions based on creation date
      if (!isWithinDateTimeRange(sessionInfo.time.created, since, until)) {
        continue;
      }

      const messageFiles = await listMessageFiles(sessionInfo.id, sessionDataDir);

      for (const messageFilePath of messageFiles) {
        try {
          const message = await readMessage(messageFilePath);
          if (message.role === "assistant" && message.tokens && isWithinDateTimeRange(message.time.created, since, until)) {
            const dateKey = getFormattedDate(message.time.created, format);
            if (!aggregatedData[dateKey]) {
              aggregatedData[dateKey] = { totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCacheReadTokens: 0, totalCacheWriteTokens: 0, models: {} };
            }
            aggregateMessage(aggregatedData[dateKey], message);
          }
        } catch (error) {
          console.warn(`Warning: Could not process message file ${messageFilePath}. Skipping.`, error);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not process session file ${sessionFile.filePath}. Skipping.`, error);
    }
  }

  const sortedKeys = Object.keys(aggregatedData).sort();
  const reportData: any[] = [];

  for (const key of sortedKeys) {
    const data = aggregatedData[key];
    // Only push to data if there's some usage within the filtered range
    if (data.totalCost > 0 || data.totalInputTokens > 0 || data.totalOutputTokens > 0) {
      const reportEntry: any = {
        period: key,
        totalCost: data.totalCost,
        inputTokens: data.totalInputTokens,
        outputTokens: data.totalOutputTokens,
        cacheReadTokens: data.totalCacheReadTokens,
        cacheWriteTokens: data.totalCacheWriteTokens,
      };
      if (showModels) {
        reportEntry.models = data.models;
      }
      reportData.push(reportEntry);
    }
  }

  if (xmlOutput) {
    console.log(generateXmlOutput(reportData, "report"));
  } else if (jsonOutput) {
    console.log(JSON.stringify(reportData, null, 2));
  } else {
    const table = new Table({
      head: ['Date/Period', 'Total Cost', 'Input Tokens', 'Output Tokens', 'Cache Read', 'Cache Write'],
      colWidths: [30, 15, 15, 15, 15, 15],
      wordWrap: true
    });

    let grandTotalCost = 0;
    let grandTotalInputTokens = 0;
    let grandTotalOutputTokens = 0;
    let grandTotalCacheReadTokens = 0;
    let grandTotalCacheWriteTokens = 0;

    for (const data of reportData) {
      table.push([
        data.period,
        "$ " + String(`${data.totalCost.toFixed(6)}`),
        String(data.inputTokens),
        String(data.outputTokens),
        String(data.cacheReadTokens),
        String(data.cacheWriteTokens)
      ]);

      grandTotalCost += data.totalCost;
      grandTotalInputTokens += data.inputTokens;
      grandTotalOutputTokens += data.outputTokens;
      grandTotalCacheReadTokens += data.cacheReadTokens;
      grandTotalCacheWriteTokens += data.cacheWriteTokens;

      // Add model breakdown rows
      if (showModels) {
        for (const modelID in data.models) {
          const modelData = data.models[modelID];
          table.push([
            `  Model: ${modelID}`, // Model ID aligned under Date/Period
            "$ " + String(`${modelData.cost.toFixed(6)}`),
            modelData.inputTokens,
            modelData.outputTokens,
            modelData.cacheReadTokens,
            modelData.cacheWriteTokens
          ]);
        }
      }
    }

    // Add total row
    table.push([
      'Total',
      "$ " + String(`${grandTotalCost.toFixed(6)}`),
      grandTotalInputTokens,
      grandTotalOutputTokens,
      grandTotalCacheReadTokens,
      grandTotalCacheWriteTokens
    ]);

    console.log(table.toString());
  }
}

async function getSessionUsage(sessionID: string, sessionDataDir: string, since?: string, until?: string, startTime?: string, endTime?: string): Promise<AggregatedData> {
  const aggregated: AggregatedData = { totalCost: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCacheReadTokens: 0, totalCacheWriteTokens: 0, models: {} };
  try {
    const messageFiles = await listMessageFiles(sessionID, sessionDataDir);
    for (const messageFilePath of messageFiles) {
      try {
        const message = await readMessage(messageFilePath);
        if (isWithinDateTimeRange(message.time.created, since, until, startTime, endTime)) {
          aggregateMessage(aggregated, message);
        }
      } catch (error) {
        console.warn(`Warning: Could not process message file ${messageFilePath}. Skipping.`, error);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read messages for session ${sessionID} in project ${sessionDataDir}. Skipping.`, error);
  }
  return aggregated;
}

export async function liveReport(showModels: boolean = true, jsonOutput: boolean = false, xmlOutput: boolean = false, dataDir?: string) {

  const sessionDataDirs = await getSessionDataDirs(dataDir);
  if (sessionDataDirs.length === 0) {
    return;
  }

  const watcher = chokidar.watch(sessionDataDirs, {
    ignored: /(^|\/)\..*|\.tmp$/,
    persistent: true,
    ignoreInitial: true,
    depth: 5 // Adjust depth as needed to cover session/info and session/message subdirectories
  });

  const activeSessions = new Map<string, { info: any; usage: AggregatedData }>();

  const updateLiveReport = async () => {
    const sessionFiles = await listSessionInfoFiles(dataDir);
    for (const sessionFile of sessionFiles) {
      try {
        const sessionInfo = sessionFile.info;
        const sessionDataDir = sessionFile.sessionDataDir;
        const sessionUsage = await getSessionUsage(sessionInfo.id, sessionDataDir);
        activeSessions.set(sessionInfo.id, { info: sessionInfo, usage: sessionUsage });
      } catch (error) {
        console.warn(`Warning: Could not process session file ${sessionFile.filePath}. Skipping.`, error);
      }
    }

    const table = new Table({
      head: ['Session ID', 'Title', 'Created', 'Total Cost', 'Input Tokens', 'Output Tokens', 'Cache Read', 'Cache Write'],
      colWidths: [15, 40, 25, 15, 15, 15, 15, 15],
      wordWrap: true
    });

    const liveReportData = Array.from(activeSessions.values())
      .filter(data => data.usage.totalCost > 0 || data.usage.totalInputTokens > 0 || data.usage.totalOutputTokens > 0)
      .map(data => {
        const entry: any = {
          id: data.info.id,
          title: data.info.title,
          created: new Date(data.info.time.created).toLocaleString(),
          totalCost: data.usage.totalCost,
          inputTokens: data.usage.totalInputTokens,
          outputTokens: data.usage.totalOutputTokens,
          cacheReadTokens: data.usage.totalCacheReadTokens,
          cacheWriteTokens: data.usage.totalCacheWriteTokens,
        };
        if (showModels) {
          entry.models = data.usage.models;
        }
        return entry;
      });

    if (xmlOutput) {
      console.log(generateXmlOutput(liveReportData, "liveReport"));
    } else if (jsonOutput) {
      console.log(JSON.stringify(liveReportData, null, 2));
    } else {
      for (const [sessionId, data] of activeSessions.entries()) {
        if (data.usage.totalCost > 0 || data.usage.totalInputTokens > 0 || data.usage.totalOutputTokens > 0) {
          table.push([
            data.info.id,
            data.info.title,
            new Date(data.info.time.created).toLocaleString(),
            "$ " + String(`${data.usage.totalCost.toFixed(6)}`),
            String(data.usage.totalInputTokens),
            String(data.usage.totalOutputTokens),
            String(data.usage.totalCacheReadTokens),
            String(data.usage.totalCacheWriteTokens)
          ]);
          if (showModels) {
            for (const modelID in data.usage.models) {
              const modelData = data.usage.models[modelID];
              table.push([
                '', // Empty for Session ID
                `  Model: ${modelID}`, // Model ID aligned under Title
                '', // Empty for Created (new empty string at index 2)
                "$ " + String(`${modelData.cost.toFixed(6)}`),
                modelData.inputTokens,
                modelData.outputTokens,
                modelData.cacheReadTokens,
                modelData.cacheWriteTokens
              ]);
            }
          }
        }
      }
      console.log(table.toString());
    }
  };

  watcher.on('add', path => {
    updateLiveReport();
  });
  watcher.on('change', path => {
    updateLiveReport();
  });
  watcher.on('unlink', path => {
    updateLiveReport();
  });

  // Initial report display
  await updateLiveReport();

  // Keep the process alive
  process.stdin.resume();
}
