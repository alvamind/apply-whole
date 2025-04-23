This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.
The content has been processed where empty lines have been removed.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: src
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Empty lines have been removed from all files
- Files are sorted by Git change count (files with more changes are at the bottom)

## Additional Info

# Directory Structure
```
src/cli.ts
src/constants.ts
src/core.ts
src/types.ts
```

# Files

## File: src/cli.ts
````typescript
#!/usr/bin/env bun
import { runApply, createDefaultDependencies } from "./core";
const main = async (): Promise<void> => {
  const deps = await createDefaultDependencies();
  try {
    await runApply(deps, process.argv);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    deps.error(deps.chalk.red(`Unhandled error: ${errorMessage}`));
    deps.exit(1);
  }
};
// Only run this if it's called directly
if (import.meta.path === Bun.main) {
  await main();
}
````

## File: src/constants.ts
````typescript
// src/constants.ts
import type { ParseArgsConfig } from "node:util";
import type { Encoding, FilePath } from "./types";
export const DEFAULT_ENCODING: Encoding = "utf-8";
// Updated regex to support path on same line or next line
export const CODE_BLOCK_START_LINE_REGEX: RegExp =
  /^```(?:[a-z]+)?\s*(?:\/\/\s*(?<path>[^\r\n]+)\s*)?$/i;
// Regex to detect if a path is on the line following the opening delimiter
export const PATH_ON_NEXT_LINE_REGEX: RegExp =
  /^\/\/\s*(?<path>[^\r\n]+)\s*$/;
export const ANY_CODE_BLOCK_DELIMITER_REGEX: RegExp = /^```/;
export const HELP_MESSAGE: string = `
Usage: bun apply [options]
Applies code blocks from a markdown source to the filesystem.
Code blocks must be formatted as:
\`\`\`[language] // path/to/your/file.ext
// File content starts here
...
\`\`\`
Analysis is performed first. If broken or invalid code blocks
(e.g., missing delimiters, incorrect start line format) are found,
issues will be reported, but the tool will attempt to apply any
blocks that appear valid.
Options:
  -i, --input <file>   Specify the input markdown file path.
                       If omitted, reads from the system clipboard.
  -h, --help           Display this help message and exit.
`;
export const ARGS_CONFIG: ParseArgsConfig = {
  options: {
    input: { type: "string", short: "i" },
    help: { type: "boolean", short: "h" },
  },
  allowPositionals: false,
  strict: true,
};
export const ExitCodes = {
  SUCCESS: 0,
  ERROR: 1,
  INVALID_ARGS: 2,
} as const;
export const NEWLINE_REGEX = /\r?\n/;
// Confirmation and Revert Messages
export const CONFIRMATION_PROMPT = "Apply these changes? (y/n): ";
export const CHANGES_APPLIED_MESSAGE = "Changes applied successfully.";
export const CHANGES_REVERTED_MESSAGE = "Changes reverted by user.";
export const REVERTING_MESSAGE = "Reverting changes...";
export const REVERT_ACTION_MESSAGE = (filePath: FilePath, action: "restored" | "deleted" | string): string =>
  `   Reverted: File ${filePath} ${action}.`;
export const REVERT_ERROR_MESSAGE = (filePath: FilePath, error: string): string =>
  `   Error reverting ${filePath}: ${error}`;
````

## File: src/types.ts
````typescript
import type { ChalkInstance } from "chalk";
import type { ParseArgsConfig } from "node:util";
export type FilePath = string;
export type FileContent = string;
export type ErrorMessage = string;
export type Milliseconds = number;
export type Nanoseconds = [number, number];
export type ExitCode = number;
export type Encoding = "utf-8";
export type LineNumber = number;
export interface CodeBlock {
  readonly filePath: FilePath;
  readonly fileContent: FileContent;
  readonly startLineNumber: LineNumber;
}
export interface AnalysisIssue {
  readonly lineNumber: LineNumber;
  readonly lineContent: string;
  readonly message: string;
}
export interface DelimiterLine {
    readonly lineNumber: LineNumber;
    readonly content: string;
}
export interface AnalysisResult {
  readonly validBlocks: ReadonlyArray<CodeBlock>;
  readonly issues: ReadonlyArray<AnalysisIssue>;
}
export interface ParsedArgsValues {
  readonly values: {
    readonly input?: string;
    readonly help?: boolean;
  };
}
export interface ParsedArgsResult {
  readonly inputFile: FilePath | null;
  readonly useClipboard: boolean;
  readonly showHelp: boolean;
}
export interface LineChanges {
    readonly linesAdded: number;
    readonly linesDeleted: number;
}
export interface WriteOperation {
  readonly block: CodeBlock;
  readonly originalContent: FileContent | null;
  readonly originallyExisted: boolean;
}
export interface WriteResult extends LineChanges {
  readonly filePath: FilePath;
  readonly success: boolean;
  readonly error?: Error;
}
export interface ProcessingStats extends LineChanges {
  readonly totalAttempted: number;
  readonly successfulWrites: number;
  readonly failedWrites: number;
  readonly durationMs: Milliseconds;
  readonly totalLinesAdded: number;
  readonly totalLinesDeleted: number;
}
export interface ApplyResult {
  readonly writeResults: ReadonlyArray<WriteResult>;
  readonly originalStates: ReadonlyArray<WriteOperation>;
  readonly stats: ProcessingStats;
}
// --- Base Dependencies ---
interface FileSystemDeps {
  readonly readFile: (filePath: FilePath, encoding: Encoding) => Promise<FileContent>;
  readonly writeFile: (filePath: FilePath, content: FileContent, encoding: Encoding) => Promise<void>;
  readonly exists: (path: FilePath) => Promise<boolean>;
  readonly mkdir: (path: FilePath, options: { readonly recursive: boolean }) => Promise<void>;
  readonly dirname: (path: FilePath) => FilePath;
  readonly unlink: (path: FilePath) => Promise<void>;
}
interface ClipboardDeps {
   readonly readClipboard: () => Promise<FileContent>;
}
interface ConsoleDeps {
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
  readonly exit: (code: number) => never;
  readonly chalk: ChalkInstance;
}
interface ProcessDeps {
  readonly parseArgs: <T extends ParseArgsConfig>(config: T) => ParsedArgsValues;
  readonly hrtime: (time?: Nanoseconds) => Nanoseconds;
  readonly prompt: (message: string) => Promise<string>;
}
// --- Combined Dependency Interface ---
export interface Dependencies extends
  FileSystemDeps,
  ClipboardDeps,
  ConsoleDeps,
  ProcessDeps {}
// --- Specific Dependency Subsets for Functions ---
export type ErrorExitDeps = Pick<Dependencies, "error" | "exit" | "chalk">;
export type CliDeps = Pick<Dependencies, "parseArgs" | "log"> & ErrorExitDeps;
export type InputDeps = Pick<Dependencies, "readFile" | "readClipboard"> & ErrorExitDeps;
export type FormatDeps = Pick<Dependencies, "chalk">;
export type DirectoryDeps = Pick<Dependencies, "exists" | "mkdir" | "dirname">;
export type WriteFileDeps = Pick<Dependencies, "writeFile" | "readFile"> & DirectoryDeps;
export type WriteProcessDeps = WriteFileDeps & Pick<Dependencies, "hrtime" | "exists">;
export type RevertDeps = Pick<Dependencies, "writeFile" | "unlink" | "log"> & ErrorExitDeps;
````

## File: src/core.ts
````typescript
import {
  DEFAULT_ENCODING,
  CODE_BLOCK_START_LINE_REGEX,
  PATH_ON_NEXT_LINE_REGEX,
  ANY_CODE_BLOCK_DELIMITER_REGEX,
  HELP_MESSAGE,
  ARGS_CONFIG,
  ExitCodes,
  NEWLINE_REGEX,
  REVERTING_MESSAGE,
  REVERT_ACTION_MESSAGE,
  REVERT_ERROR_MESSAGE,
  CONFIRMATION_PROMPT,
  CHANGES_APPLIED_MESSAGE,
  CHANGES_REVERTED_MESSAGE,
} from "./constants";
import type {
  FilePath,
  FileContent,
  CodeBlock,
  AnalysisResult,
  AnalysisIssue,
  WriteResult,
  ApplyResult,
  Dependencies,
  Encoding,
  Nanoseconds,
  Milliseconds,
  ParsedArgsResult,
  ParsedArgsValues,
  LineChanges,
  ProcessingStats,
  WriteOperation,
  ErrorExitDeps,
  CliDeps,
  InputDeps,
  FormatDeps,
  DirectoryDeps,
  WriteFileDeps,
  WriteProcessDeps,
  RevertDeps,
} from "./types";
import chalk from "chalk";
import clipboardy from "clipboardy";
const nanosecondsToMilliseconds = (diff: Nanoseconds): Milliseconds =>
  (diff[0] * 1e9 + diff[1]) / 1e6;
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
const reportErrorAndExit = (
  deps: ErrorExitDeps,
  message: string,
  exitCode: typeof ExitCodes[keyof typeof ExitCodes],
  helpText?: string
): never => {
  deps.error(deps.chalk.red(message));
  if (helpText) {
    deps.error(helpText);
  }
  return deps.exit(exitCode);
};
const parseCliArguments = (
  deps: CliDeps,
  argv: ReadonlyArray<string>
): ParsedArgsResult => {
  try {
    const parsed: ParsedArgsValues = deps.parseArgs({ ...ARGS_CONFIG, args: argv.slice(2) });
    const showHelp = parsed.values.help ?? false;
    const inputFile = parsed.values.input ?? null;
    if (showHelp) {
      deps.log(HELP_MESSAGE);
      return deps.exit(ExitCodes.SUCCESS);
    }
    return {
      inputFile,
      useClipboard: !inputFile,
      showHelp: false,
    };
  } catch (err: unknown) {
    return reportErrorAndExit(
      deps,
      `Invalid arguments: ${getErrorMessage(err)}`,
      ExitCodes.INVALID_ARGS,
      HELP_MESSAGE
    );
  }
};
const getInputContent = async (
  deps: InputDeps,
  args: ParsedArgsResult,
  encoding: Encoding
): Promise<FileContent> => {
  const sourceDescription = args.inputFile
    ? `file: ${deps.chalk.cyan(args.inputFile)}`
    : "clipboard";
  deps.error(deps.chalk.blue(`Reading from ${sourceDescription}...`));
  const readFileOrClipboard = async (): Promise<FileContent> => {
    if (args.inputFile) {
      return deps.readFile(args.inputFile, encoding);
    }
    if (args.useClipboard) {
      const content = await deps.readClipboard();
      if (!content || content.trim().length === 0) {
        throw new Error("Clipboard is empty or contains only whitespace.");
      }
      return content;
    }
    throw new Error("No input source specified (file or clipboard).");
  };
  try {
    return await readFileOrClipboard();
  } catch (error: unknown) {
    const baseMsg = `Failed to read from ${sourceDescription}`;
    const specificError = getErrorMessage(error);
    let hint = "";
    if (args.inputFile && specificError.includes('ENOENT')) {
      hint = deps.chalk.yellow(`Hint: Ensure the file '${args.inputFile}' exists.`);
    } else if (args.useClipboard) {
      hint = deps.chalk.yellow(`Hint: Ensure system clipboard access is allowed and it contains text.\nAlternatively, use the '-i <file>' flag to specify an input file instead of using clipboard.`);
    }
    return reportErrorAndExit(deps, `${baseMsg}: ${specificError}`, ExitCodes.ERROR, hint || undefined);
  }
};
const analyzeMarkdownContent = (
    markdownContent: FileContent
): AnalysisResult => {
    const lines = markdownContent.split(NEWLINE_REGEX);
    const issues: AnalysisIssue[] = [];
    const validBlocks: CodeBlock[] = [];
    let inCodeBlock = false;
    let currentBlockStart = 0;
    let currentBlockPath = "";
    let contentStart = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const trimmedLine = line.trimStart();
        if (ANY_CODE_BLOCK_DELIMITER_REGEX.test(trimmedLine)) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                currentBlockStart = i;
                const match = trimmedLine.match(CODE_BLOCK_START_LINE_REGEX);
                if (match?.groups?.['path']) {
                    currentBlockPath = match.groups['path'].trim();
                    contentStart = i + 1;
                } else if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1] ?? "";
                    const pathMatch = nextLine.match(PATH_ON_NEXT_LINE_REGEX);
                    if (pathMatch?.groups?.['path']) {
                        currentBlockPath = pathMatch.groups['path'].trim();
                        contentStart = i + 2;
                    } else {
                        currentBlockPath = "";
                    }
                } else {
                    currentBlockPath = "";
                }
            } else {
                inCodeBlock = false;
                if (currentBlockPath) {
                    const contentEnd = i;
                    const blockContent = lines.slice(contentStart, contentEnd).join('\n');
                    validBlocks.push({
                        filePath: currentBlockPath,
                        fileContent: blockContent,
                        startLineNumber: currentBlockStart + 1
                    });
                } else {
                    issues.push({
                        lineNumber: currentBlockStart + 1,
                        lineContent: lines[currentBlockStart] ?? "",
                        message: "Invalid code block start tag format. Expected: ```[lang] // path/to/file.ext`",
                    });
                }
                currentBlockPath = "";
            }
        }
    }
    if (inCodeBlock) {
        issues.push({
            lineNumber: currentBlockStart + 1,
            lineContent: lines[currentBlockStart] ?? "",
            message: "Found an odd number of '```' delimiters. Blocks may be incomplete or incorrectly matched.",
        });
    }
    return {
        validBlocks: Object.freeze(validBlocks),
        issues: Object.freeze(issues),
    };
};
const ensureDirectoryExists = async (
  deps: DirectoryDeps,
  filePath: FilePath
): Promise<void> => {
  const dir = deps.dirname(filePath);
  if (dir && dir !== '.' && dir !== '/') {
      const dirExists = await deps.exists(dir);
      if (!dirExists) {
          await deps.mkdir(dir, { recursive: true });
      }
  }
};
const calculateLineChanges = (
    oldContent: FileContent | null,
    newContent: FileContent
): LineChanges => {
    const oldLines = oldContent?.split(NEWLINE_REGEX) ?? [];
    const newLines = newContent.split(NEWLINE_REGEX);
    return {
        linesAdded: Math.max(0, newLines.length - oldLines.length),
        linesDeleted: Math.max(0, oldLines.length - newLines.length)
    };
};
const performWrite = async (
  deps: WriteFileDeps,
  block: CodeBlock,
  encoding: Encoding
): Promise<WriteResult> => {
  let oldContent: FileContent | null = null;
  try {
    await ensureDirectoryExists(deps, block.filePath);
    try {
      oldContent = await deps.readFile(block.filePath, encoding);
    } catch (readError: unknown) {
      if (!(readError instanceof Error && 'code' in readError && readError.code === 'ENOENT')) {
        throw readError;
      }
    }
    await deps.writeFile(block.filePath, block.fileContent, encoding);
    const lineChanges = calculateLineChanges(oldContent, block.fileContent);
    return { filePath: block.filePath, success: true, ...lineChanges };
  } catch (error: unknown) {
    return {
      filePath: block.filePath,
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      linesAdded: 0,
      linesDeleted: 0,
    };
  }
};
const writeFiles = async (
  deps: WriteProcessDeps,
  blocks: ReadonlyArray<CodeBlock>,
  encoding: Encoding
): Promise<ApplyResult> => {
  const startTime = deps.hrtime();
  const originalStates = await Promise.all(blocks.map(async (block) => {
    let originalContent: FileContent | null = null;
    const fileExists = await deps.exists(block.filePath);
    if (fileExists) {
      try {
        originalContent = await deps.readFile(block.filePath, encoding);
      } catch (error) {
        originalContent = null;
      }
    }
    return { block, originalContent, originallyExisted: fileExists };
  }));
  const writeResults = await Promise.all(blocks.map(block => performWrite(deps, block, encoding)));
  const endTime = deps.hrtime(startTime);
  const durationMs = nanosecondsToMilliseconds(endTime);
  const initialStats: ProcessingStats = {
      totalAttempted: blocks.length, successfulWrites: 0, failedWrites: 0,
      totalLinesAdded: 0, totalLinesDeleted: 0, linesAdded: 0, linesDeleted: 0, durationMs,
  };
  const finalStats = writeResults.reduce((stats, result) => ({
      ...stats,
      successfulWrites: stats.successfulWrites + (result.success ? 1 : 0),
      failedWrites: stats.failedWrites + (result.success ? 0 : 1),
      totalLinesAdded: stats.totalLinesAdded + result.linesAdded,
      totalLinesDeleted: stats.totalLinesDeleted + result.linesDeleted,
  }), initialStats);
  return {
    writeResults: Object.freeze(writeResults),
    originalStates: Object.freeze(originalStates),
    stats: finalStats
  };
};
const formatAnalysisIssues = (
    deps: FormatDeps,
    issues: ReadonlyArray<AnalysisIssue>
): string[] => {
  return issues.map(
    (issue) =>
      `   ${deps.chalk.yellow(`[Line ${issue.lineNumber}]`)}: ${issue.message}\n   ${deps.chalk.dim(issue.lineContent)}`
  );
};
const formatWriteResults = (
  deps: FormatDeps,
  { writeResults, stats }: ApplyResult
): string => {
  const resultLines: string[] = writeResults.map((result) => {
    const statusIcon = result.success ? deps.chalk.green("✔") : deps.chalk.red("✗");
    const action = result.success ? "Written" : "Failed";
    const changeStats = result.success
        ? ` ${deps.chalk.green(`(+${result.linesAdded}`)}, ${deps.chalk.red(`-${result.linesDeleted})`)}`
        : "";
    let line = `${statusIcon} ${action}: ${result.filePath}${changeStats}`;
    if (!result.success && result.error) {
      line += ` (${deps.chalk.red(getErrorMessage(result.error))})`;
    }
    return line;
  });
  const duration = stats.durationMs.toFixed(2);
  const summary = [
    `\n${deps.chalk.bold("Summary:")}`,
    `Attempted: ${stats.totalAttempted} file(s) (${deps.chalk.green(
      `${stats.successfulWrites} succeeded`
    )}, ${deps.chalk.red(`${stats.failedWrites} failed`)})`,
    `Lines changed: ${deps.chalk.green(`+${stats.totalLinesAdded}`)}, ${deps.chalk.red(`-${stats.totalLinesDeleted}`)}`,
    stats.durationMs > 0 ? `Completed in ${duration}ms` : "",
  ].filter(Boolean);
  return [...resultLines, ...summary].join("\n");
};
const revertChanges = async (
  deps: RevertDeps,
  successfulWriteResults: ReadonlyArray<WriteResult>,
  originalStates: ReadonlyArray<WriteOperation>,
  encoding: Encoding
): Promise<boolean> => {
  deps.error(deps.chalk.yellow(REVERTING_MESSAGE));
  let allRevertedSuccessfully = true;
  const revertPromises = successfulWriteResults.map(async (result) => {
    const originalState = originalStates.find(os => os.block.filePath === result.filePath);
    if (!originalState) {
      deps.error(deps.chalk.red(`   Error: Cannot find original state for ${result.filePath} to revert.`));
      allRevertedSuccessfully = false;
      return;
    }
    try {
      if (originalState.originallyExisted) {
        if (originalState.originalContent !== null) {
          await deps.writeFile(result.filePath, originalState.originalContent, encoding);
          deps.log(REVERT_ACTION_MESSAGE(result.filePath, "restored"));
        } else {
          await deps.unlink(result.filePath);
          deps.log(REVERT_ACTION_MESSAGE(result.filePath, "deleted (original content was null/unreadable)"));
        }
      } else {
        await deps.unlink(result.filePath);
        deps.log(REVERT_ACTION_MESSAGE(result.filePath, "deleted"));
      }
    } catch (revertError: unknown) {
      deps.error(deps.chalk.red(REVERT_ERROR_MESSAGE(result.filePath, getErrorMessage(revertError))));
      allRevertedSuccessfully = false;
    }
  });
  await Promise.all(revertPromises);
  return allRevertedSuccessfully;
};
const confirmAndPotentiallyRevert = async (
    deps: Dependencies,
    applyResult: ApplyResult,
    encoding: Encoding
): Promise<{ shouldKeepChanges: boolean; finalExitCode: number }> => {
    const successfulWrites = applyResult.writeResults.filter(r => r.success);
    if (successfulWrites.length === 0) {
        return { shouldKeepChanges: false, finalExitCode: applyResult.stats.failedWrites > 0 ? ExitCodes.ERROR : ExitCodes.SUCCESS };
    }
    const isTestEnvironment = process.env['BUN_APPLY_AUTO_YES'] === 'true';
    let shouldKeepChanges = true;
    if (!isTestEnvironment) {
        const response = await deps.prompt(deps.chalk.yellow(CONFIRMATION_PROMPT));
        const confirmation = response.toLowerCase().trim();
        shouldKeepChanges = confirmation === 'y' || confirmation === 'yes';
    }
    if (shouldKeepChanges) {
        deps.log(deps.chalk.green(CHANGES_APPLIED_MESSAGE));
        return { shouldKeepChanges: true, finalExitCode: applyResult.stats.failedWrites > 0 ? ExitCodes.ERROR : ExitCodes.SUCCESS };
    } else {
        const revertSuccessful = await revertChanges(
            deps,
            successfulWrites,
            applyResult.originalStates,
            encoding
        );
        if (revertSuccessful) {
            deps.log(deps.chalk.green(CHANGES_REVERTED_MESSAGE));
            return { shouldKeepChanges: false, finalExitCode: ExitCodes.SUCCESS }; // Revert success overrides prior write errors for final status
        } else {
            deps.error(deps.chalk.red("Errors occurred during revert operation. Filesystem may be in an inconsistent state."));
            return { shouldKeepChanges: false, finalExitCode: ExitCodes.ERROR }; // Revert failure is an error
        }
    }
};
const runApply = async (
  deps: Dependencies,
  argv: ReadonlyArray<string>
): Promise<void> => {
  let finalExitCode: number = ExitCodes.SUCCESS;
  try {
    const args = parseCliArguments(deps, argv);
    const content = await getInputContent(deps, args, DEFAULT_ENCODING);
    deps.error(deps.chalk.blue("Analyzing markdown content..."));
    const { validBlocks, issues } = analyzeMarkdownContent(content);
    if (issues.length > 0) {
      deps.error(deps.chalk.yellow("\nAnalysis Issues Found:"));
      formatAnalysisIssues(deps, issues).forEach(issue => deps.error(issue));
      finalExitCode = ExitCodes.ERROR;
      if (validBlocks.length === 0) {
         deps.error(deps.chalk.red("\nNo valid code blocks were extracted due to analysis issues."));
         return deps.exit(finalExitCode);
      }
      deps.error(deps.chalk.yellow("\nAttempting to process any valid blocks found..."));
    } else {
      deps.error(deps.chalk.green("Analysis complete. No issues found."));
    }
    if (validBlocks.length === 0) {
        deps.error(deps.chalk.blue("No valid code blocks found to apply."));
    } else {
        deps.error(
            deps.chalk.blue(`Applying changes for ${validBlocks.length} valid code block(s)...`)
        );
        const applyResult = await writeFiles(deps, validBlocks, DEFAULT_ENCODING);
        deps.log(formatWriteResults(deps, applyResult)); // Use log for final results
        // Determine final exit code based on apply and potential revert
        const confirmResult = await confirmAndPotentiallyRevert(deps, applyResult, DEFAULT_ENCODING);
        // If there were analysis issues, always maintain the ERROR exit code
        if (finalExitCode === ExitCodes.ERROR) {
            // Keep the ERROR status from analysis issues regardless of apply success
        } else {
            // Otherwise use the exit code from confirmation/revert
            finalExitCode = confirmResult.finalExitCode;
        }
    }
    if (finalExitCode === ExitCodes.ERROR) {
      deps.error(deps.chalk.red(`Finished with issues.`));
    } else {
      deps.error(deps.chalk.green("Finished successfully."));
    }
    deps.exit(finalExitCode);
  } catch (err: unknown) {
    deps.error(deps.chalk.red(`Unexpected error: ${getErrorMessage(err)}`));
    deps.exit(ExitCodes.ERROR);
  }
};
const createDefaultDependencies = async (): Promise<Dependencies> => {
  const { parseArgs: nodeParseArgs } = await import("node:util");
  const { dirname: nodeDirname } = await import("node:path");
  const { stat, mkdir: nodeMkdir, unlink: nodeUnlink } = await import("node:fs/promises");
  const readFile = (filePath: FilePath, _encoding: Encoding): Promise<FileContent> =>
    Bun.file(filePath).text();
  const writeFile = (filePath: FilePath, content: FileContent, _encoding: Encoding): Promise<void> =>
    Bun.write(filePath, content).then(() => {});
  const exists = async (path: FilePath): Promise<boolean> => {
      try {
          await stat(path);
          return true;
      } catch (error: unknown) {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
              return false;
          }
          throw error;
      }
  };
   const mkdir = async (path: FilePath, options: { readonly recursive: boolean }): Promise<void> => {
      await nodeMkdir(path, options);
  }
  const readClipboard = async (): Promise<FileContent> => {
    try {
      const content = await clipboardy.read();
      return content ?? "";
    } catch (error) {
      throw new Error(`Failed to read from clipboard: ${getErrorMessage(error)}`);
    }
  };
  const prompt = async (message: string): Promise<string> => {
    process.stdout.write(message);
    return new Promise((resolve) => {
      process.stdin.once('data', (data: Buffer) => resolve(data.toString().trim()));
    });
  };
  const unlink = async (path: FilePath): Promise<void> => {
    await nodeUnlink(path);
  };
  return Object.freeze({
    readFile,
    writeFile,
    exists,
    mkdir,
    dirname: nodeDirname,
    readClipboard,
    log: console.log,
    error: console.error,
    exit: process.exit,
    chalk,
    parseArgs: nodeParseArgs,
    hrtime: process.hrtime,
    prompt,
    unlink
  });
};
const main = async (): Promise<void> => {
  const deps = await createDefaultDependencies();
  try {
    await runApply(deps, Bun.argv);
  } catch (error: unknown) {
    deps.error(deps.chalk.red(`Unhandled error in main: ${getErrorMessage(error)}`));
    deps.exit(ExitCodes.ERROR);
  }
};
if (import.meta.path === Bun.main) {
  await main();
}
export {
  parseCliArguments,
  getInputContent,
  analyzeMarkdownContent,
  writeFiles,
  formatAnalysisIssues,
  formatWriteResults,
  runApply,
  createDefaultDependencies,
  calculateLineChanges,
  performWrite,
  ensureDirectoryExists,
  revertChanges,
};
````
