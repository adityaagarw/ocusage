import path from "path";
import fs from "fs/promises";
import os from "os";

const APP_NAME = "opencode";

function getXdgDataHome(): string {
  if (process.env.XDG_DATA_HOME) {
    return process.env.XDG_DATA_HOME;
  }
  
  // Windows uses LOCALAPPDATA for application data
  if (process.platform === 'win32') {
    return process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  }
  
  // Unix/Linux/macOS use XDG specification
  return path.join(os.homedir(), ".local", "share");
}

export async function getOpencodeBaseDataDir(baseDir?: string): Promise<string> {
  const dataDir = baseDir ? path.resolve(baseDir) : path.join(getXdgDataHome(), APP_NAME, "project");
  
  // Only check if directory exists - never create directories
  try {
    await fs.access(dataDir);
    return dataDir;
  } catch (error) {
    throw new Error(`opencode data directory not found: ${dataDir}. Please ensure opencode is installed and has generated usage data.`);
  }
}

export async function getOpencodeProjectDataDirs(dataDir?: string): Promise<string[]> {
  const baseDataDir = await getOpencodeBaseDataDir(dataDir);
  const projectDirs: string[] = [];
  try {
    const entries = await fs.readdir(baseDataDir, { withFileTypes: true });
    for (const dirent of entries) {
      if (dirent.isDirectory()) {
        projectDirs.push(path.join(baseDataDir, dirent.name));
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.warn(`Warning: Base data directory not found at ${baseDataDir}. No opencode projects will be processed.`);
      return []; // Directory does not exist, return empty array gracefully
    }
    console.error(`Error reading project directories from ${baseDataDir}:`, error);
    throw error; // Re-throw other errors
  }
  return projectDirs;
}

export async function getSessionDataDirs(dataDir?: string): Promise<string[]> {
  const projectDataDirs = await getOpencodeProjectDataDirs(dataDir);
  const sessionDataDirs: string[] = [];
  for (const projectDataDir of projectDataDirs) {
    sessionDataDirs.push(path.join(projectDataDir, "storage", "session"));
  }
  return sessionDataDirs;
}

// TypeScript Interfaces based on opencode source code
export interface SessionInfo {
  id: string;
  parentID?: string;
  share?: { url: string };
  title: string;
  version: string;
  time: { created: number; updated: number };
  revert?: {
    messageID: string;
    partID?: string;
    snapshot?: string;
    diff?: string;
  };
}

export interface MessageInfo {
  id: string;
  role: "user" | "assistant";
  sessionID: string;
  time: { created: number; completed?: number };
  system?: string[];
  mode?: string;
  path?: { cwd: string; root: string };
  cost: number;
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
  modelID?: string;
  providerID?: string;
  summary?: boolean;
  error?: any; // You might want to define a more specific error interface
}

export interface SessionInfoFile {
  filePath: string;
  sessionDataDir: string; // Changed from projectDataDir
  info: SessionInfo;
}

export async function listSessionInfoFiles(dataDir?: string): Promise<SessionInfoFile[]> {
  const sessionDataDirs = await getSessionDataDirs(dataDir);
  const allSessionInfoFiles: SessionInfoFile[] = [];

  for (const sessionDataDir of sessionDataDirs) {
    const sessionInfoDir = path.join(sessionDataDir, "info");
    try {
      const files = await fs.readdir(sessionInfoDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(sessionInfoDir, file);
          try {
            const content = await fs.readFile(filePath, "utf-8");
            const info = JSON.parse(content) as SessionInfo;
            // Corrected extraction of projectDataDir
            const sessionDataDirFromInfo = path.dirname(sessionInfoDir); // This is .../storage/session
            const projectDataDir = path.dirname(path.dirname(sessionDataDirFromInfo)); // This is .../project/<project_name>
            allSessionInfoFiles.push({ filePath, sessionDataDir, info }); // Pass sessionDataDir
          } catch (error) {
            console.warn(`Warning: Could not read or parse session info file ${filePath}. Skipping.`, error);
          }
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        //console.warn(`Warning: Session info directory not found at ${sessionInfoDir}. Skipping.`);
      } else {
        //console.error(`Error reading session info files from ${sessionInfoDir}:`, error);
      }
    }
  }
  return allSessionInfoFiles;
}

export async function readSessionInfo(filePath: string): Promise<SessionInfo> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as SessionInfo;
  } catch (error) {
    console.error(`Error reading or parsing session info file ${filePath}:`, error);
    throw error; // Re-throw to be handled by the caller (e.g., sessionReport)
  }
}

export async function listMessageFiles(sessionID: string, sessionDataDir: string): Promise<string[]> { // Changed parameter
  const allMessageFiles: string[] = [];
  const messageDir = path.join(sessionDataDir, "message", sessionID); // Corrected path construction

  try {
    const files = await fs.readdir(messageDir); // Line 143
    files.filter(file => file.endsWith(".json")).forEach(file => {
      allMessageFiles.push(path.join(messageDir, file));
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      //console.warn(`Warning: Message directory not found for session ${sessionID} at ${messageDir}. Skipping.`);
    } else {
      //console.error(`Error reading message files for session ${sessionID} from ${messageDir}:`, error);
    }
  }
  return allMessageFiles;
}

export async function readMessage(filePath: string): Promise<MessageInfo> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as MessageInfo;
  } catch (error) {
    console.error(`Error reading or parsing message file ${filePath}:`, error);
    throw error; // Re-throw to be handled by the caller (e.g., sessionReport)
  }
}