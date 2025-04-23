```typescript
// src/types.ts
import type { ChalkInstance } from "chalk";
import type { ParseArgsConfig } from "node:util";
import type { ReadKeyFunction } from "bun"; // Import ReadKeyFunction for prompt dependency

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

// Represents the state *before* a write operation
export interface WriteOperation {
  readonly block: CodeBlock;
  readonly originalContent: FileContent | null; // Content before write, null if didn't exist
  readonly originallyExisted: boolean;         // Did the file exist before the write attempt?
}

// Represents the outcome *after* a write operation attempt
export interface WriteResult extends LineChanges {
  readonly filePath: FilePath;
  readonly success: boolean;
  readonly error?: Error;
  // Removed originalContent and originallyExisted from here
}

export interface ProcessingStats extends LineChanges {
  readonly totalAttempted: number;
  readonly successfulWrites: number;
  readonly failedWrites: number;
  readonly durationMs: Milliseconds;
  readonly totalLinesAdded: number; // Aggregate of linesAdded
  readonly totalLinesDeleted: number; // Aggregate of linesDeleted
}

export interface ApplyResult {
  readonly writeResults: ReadonlyArray<WriteResult>;
  readonly originalStates: ReadonlyArray<WriteOperation>; // Holds pre-write info needed for revert
  readonly stats: ProcessingStats;
}

export interface Dependencies {
  readonly readFile: (filePath: FilePath, encoding: Encoding) => Promise<FileContent>;
  readonly writeFile: (filePath: FilePath, content: FileContent, encoding: Encoding) => Promise<void>;
  readonly exists: (path: FilePath) => Promise<boolean>;
  readonly mkdir: (path: FilePath, options: { readonly recursive: boolean }) => Promise<void>;
  readonly dirname: (path: FilePath) => FilePath;
  readonly readClipboard: () => Promise<FileContent>;
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
  readonly exit: (code: number) => never;
  readonly chalk: ChalkInstance;
  readonly parseArgs: <T extends ParseArgsConfig>(config: T) => ParsedArgsValues;
  readonly hrtime: (time?: Nanoseconds) => Nanoseconds;
  readonly prompt: (message: string) => Promise<string>; // Added for user confirmation
  readonly unlink: (path: FilePath) => Promise<void>;   // Added for reverting newly created files
}

```
```typescript
// src/constants.ts
// src/constants.ts
import type { ParseArgsConfig } from "node:util";
import type { Encoding } from "./types";

export const DEFAULT_ENCODING: Encoding = "utf-8";
export const CODE_BLOCK_START_LINE_REGEX: RegExp =
  /^```(?:[a-z]+)?\s*\/\/\s*(?<path>[^\r\n]+)\s*$/i;
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

After applying changes, you will be prompted to confirm or revert.

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
export const CONFIRMATION_PROMPT: string = "Apply these changes? (y/n, default: n): ";
export const CHANGES_APPLIED_MESSAGE: string = "Changes applied.";
export const CHANGES_REVERTED_MESSAGE: string = "Changes reverted by user.";
export const REVERTING_MESSAGE: string = "Reverting changes...";
export const REVERT_ACTION_MESSAGE = (filePath: string, action: "restored" | "deleted"): string =>
  `   Reverted: File ${filePath} ${action}.`;
export const REVERT_ERROR_MESSAGE = (filePath: string, error: string): string =>
  `   Error reverting ${filePath}: ${error}`;

```
```typescript
// src/core.ts
import {
  DEFAULT_ENCODING,
  CODE_BLOCK_START_LINE_REGEX,
  ANY_CODE_BLOCK_DELIMITER_REGEX,
  HELP_MESSAGE,
  ARGS_CONFIG,
  ExitCodes,
  NEWLINE_REGEX,
  CONFIRMATION_PROMPT,
  CHANGES_APPLIED_MESSAGE,
  CHANGES_REVERTED_MESSAGE,
  REVERTING_MESSAGE,
  REVERT_ACTION_MESSAGE,
  REVERT_ERROR_MESSAGE,
} from "./constants";
import type {
  FilePath,
  FileContent,
  CodeBlock,
  AnalysisResult,
  AnalysisIssue,
  DelimiterLine,
  WriteResult,
  WriteOperation, // Import new type
  ApplyResult,
  Dependencies,
  Encoding,
  Nanoseconds,
  Milliseconds,
  ParsedArgsResult,
  ParsedArgsValues,
  LineChanges,
  ProcessingStats,
} from "./types";
import chalk from "chalk";
import clipboardy from "clipboardy";
import { prompt } from "bun"; // Import bun's prompt

const nanosecondsToMilliseconds = (diff: Nanoseconds): Milliseconds =>
  (diff[0] * 1e9 + diff[1]) / 1e6;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const reportErrorAndExit = (
  deps: Pick<Dependencies, "error" | "exit" | "chalk">,
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
  deps: Pick<Dependencies, "parseArgs" | "error" | "log" | "exit" | "chalk">,
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
    const useClipboard = !inputFile;
    return {
      inputFile,
      useClipboard,
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
  deps: Pick<Dependencies, "readFile" | "readClipboard" | "chalk" | "error" | "exit">,
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
    const delimiterLines: DelimiterLine[] = lines.reduce(
        (acc: DelimiterLine[], lineContent, index) =>
            ANY_CODE_BLOCK_DELIMITER_REGEX.test(lineContent.trimStart())
                ? [...acc, { lineNumber: index + 1, content: lineContent }]
                : acc,
        []
    );

    if (delimiterLines.length % 2 !== 0) {
        const lastDelimiter = delimiterLines[delimiterLines.length - 1];
        if (lastDelimiter) {
            issues.push({
                lineNumber: lastDelimiter.lineNumber,
                lineContent: lastDelimiter.content,
                message: "Found an odd number of '```' delimiters. Blocks may be incomplete or incorrectly matched.",
            });
        }
    }

    for (let i = 0; i < delimiterLines.length - 1; i += 2) {
        const startLine = delimiterLines[i];
        const endLine = delimiterLines[i + 1];
        if (!startLine || !endLine) continue; // Should not happen with the odd check, but belts and suspenders

        const trimmedStartLineContent = startLine.content.trim();
        const match = trimmedStartLineContent.match(CODE_BLOCK_START_LINE_REGEX);

        if (!match?.groups?.['path']) {
            issues.push({
                lineNumber: startLine.lineNumber,
                lineContent: startLine.content,
                message: "Invalid code block start tag format. Expected: ```[lang] // path/to/file.ext`",
            });
        } else {
            // Extract content between the delimiters, excluding the start line itself
            const codeContent = lines
                .slice(startLine.lineNumber, endLine.lineNumber - 1)
                .join('\n');

            validBlocks.push({
                filePath: match.groups['path'].trim(),
                fileContent: codeContent,
                startLineNumber: startLine.lineNumber,
            });
        }
    }

    return {
        validBlocks: Object.freeze(validBlocks),
        issues: Object.freeze(issues),
    };
};

const ensureDirectoryExists = async (
  deps: Pick<Dependencies, "exists" | "mkdir" | "dirname">,
  filePath: FilePath
): Promise<void> => {
  const dir = deps.dirname(filePath);
  // Avoid trying to create '.' or '/'
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
    const linesAdded = Math.max(0, newLines.length - oldLines.length);
    const linesDeleted = Math.max(0, oldLines.length - newLines.length);
    return { linesAdded, linesDeleted };
};

// New function to prepare the write operation by capturing the original state
const prepareWriteOperation = async (
    deps: Pick<Dependencies, "readFile" | "exists">,
    block: CodeBlock,
    encoding: Encoding
): Promise<WriteOperation> => {
    let originalContent: FileContent | null = null;
    let originallyExisted = false;
    try {
        originallyExisted = await deps.exists(block.filePath);
        if (originallyExisted) {
            originalContent = await deps.readFile(block.filePath, encoding);
        }
    } catch (readError: unknown) {
        // Ignore read errors if file exists check passed? Or maybe only ENOENT on exists is truly 'doesn't exist'.
        // Let's assume exists() is reliable. If readFile fails after exists is true, it's a real error.
        // However, for simplicity in revert, treat failure to read existing file as "cannot revert content".
        console.warn(`Warning: Could not read existing file ${block.filePath}: ${getErrorMessage(readError)}`);
        originalContent = null; // Cannot reliably revert content
    }
    return {
        block,
        originalContent,
        originallyExisted,
    };
};

// New function to perform a single write based on a prepared operation
const performSingleWrite = async (
    deps: Pick<Dependencies, "writeFile" | "mkdir" | "dirname" | "exists">,
    operation: WriteOperation,
    encoding: Encoding
): Promise<WriteResult> => {
    try {
        await ensureDirectoryExists(deps, operation.block.filePath);
        await deps.writeFile(operation.block.filePath, operation.block.fileContent, encoding);
        const lineChanges = calculateLineChanges(operation.originalContent, operation.block.fileContent);
        return { filePath: operation.block.filePath, success: true, ...lineChanges };
    } catch (error: unknown) {
        return {
            filePath: operation.block.filePath,
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            linesAdded: 0,
            linesDeleted: 0,
        };
    }
};

// Modified writeFiles to prepare, perform, and collect original states
const writeFiles = async (
  deps: Pick<Dependencies, "writeFile" | "readFile" | "exists" | "mkdir" | "dirname" | "hrtime">,
  blocks: ReadonlyArray<CodeBlock>,
  encoding: Encoding
): Promise<ApplyResult> => {
  const startTime = deps.hrtime();

  // 1. Prepare all operations (read original states) concurrently
  const preparePromises = blocks.map(block => prepareWriteOperation(deps, block, encoding));
  const originalStates = await Promise.all(preparePromises);

  // 2. Perform all writes concurrently based on prepared operations
  const writePromises = originalStates.map(op => performSingleWrite(deps, op, encoding));
  const writeResults = await Promise.all(writePromises);

  const endTime = deps.hrtime(startTime);
  const durationMs = nanosecondsToMilliseconds(endTime);

  // 3. Calculate stats
  const initialStats: ProcessingStats = {
      totalAttempted: blocks.length,
      successfulWrites: 0,
      failedWrites: 0,
      totalLinesAdded: 0,
      totalLinesDeleted: 0,
      linesAdded: 0, // These base properties seem redundant with totalLinesAdded/Deleted
      linesDeleted: 0,
      durationMs,
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
    originalStates: Object.freeze(originalStates), // Include original states for potential revert
    stats: finalStats
  };
};

// New function to revert changes based on original states
const revertChanges = async (
    deps: Pick<Dependencies, "writeFile" | "unlink" | "log" | "error" | "chalk">,
    successfulWriteResults: ReadonlyArray<WriteResult>,
    originalStates: ReadonlyArray<WriteOperation>,
    encoding: Encoding
): Promise<boolean> => {
    deps.error(deps.chalk.yellow(REVERTING_MESSAGE)); // Use error stream for progress like other steps
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
                    // File existed but couldn't be read, or was empty. We wrote something, now revert?
                    // Safest might be to leave the (potentially modified) file, but log a warning.
                    // Or delete it? Let's try deleting it if original content is null but it existed.
                    // await deps.writeFile(result.filePath, "", encoding); // Write empty? Seems less correct than deleting if it was truly empty.
                    // For now, log that we can't restore content. If originally it was empty, maybe deleting is better?
                    deps.error(deps.chalk.yellow(`   Warning: Original content for ${result.filePath} was null or unreadable; cannot restore exact previous state.`));
                     // If we want to be strict: delete if original content is null
                     await deps.unlink(result.filePath);
                     deps.log(REVERT_ACTION_MESSAGE(result.filePath, "deleted (original content was null/unreadable)"));

                }
            } else {
                // File did not exist originally, so delete the one we created
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


const formatAnalysisIssues = (
    deps: Pick<Dependencies, "chalk">,
    issues: ReadonlyArray<AnalysisIssue>
): string[] => {
  return issues.map(
    (issue) =>
      `   ${deps.chalk.yellow(`[Line ${issue.lineNumber}]`)}: ${issue.message}\n   ${deps.chalk.dim(issue.lineContent)}`
  );
};

const formatWriteResults = (
  deps: Pick<Dependencies, "chalk">,
  { writeResults, stats }: ApplyResult // Takes ApplyResult now
): string => {
  const resultLines: string[] = writeResults.map((result) => {
    const statusIcon = result.success ? deps.chalk.green("✔") : deps.chalk.red("✗");
    // Keep "Written" / "Failed" terminology for the initial attempt report
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
    stats.durationMs > 0 ? `Completed initial apply in ${duration}ms` : "", // Updated text
  ].filter(Boolean); // Remove empty strings

  return [...resultLines, ...summary].join("\n");
};

const runApply = async (
  deps: Dependencies,
  argv: ReadonlyArray<string>
): Promise<void> => {
  let finalExitCode: number = ExitCodes.SUCCESS; // Assume success unless errors occur

  try {
    const args = parseCliArguments(deps, argv);
    const content = await getInputContent(deps, args, DEFAULT_ENCODING);
    deps.error(deps.chalk.blue("Analyzing markdown content..."));
    const { validBlocks, issues } = analyzeMarkdownContent(content);

    if (issues.length > 0) {
      deps.error(deps.chalk.yellow("\nAnalysis Issues Found:"));
      formatAnalysisIssues(deps, issues).forEach(issue => deps.error(issue));
      finalExitCode = ExitCodes.ERROR; // Mark potential failure
      if (validBlocks.length === 0) {
         deps.error(deps.chalk.red("\nNo valid code blocks were extracted due to analysis issues. Aborting."));
         return deps.exit(finalExitCode);
      }
      deps.error(deps.chalk.yellow("\nAttempting to process any valid blocks found..."));
    } else {
      deps.error(deps.chalk.green("Analysis complete. No issues found."));
    }

    if (validBlocks.length === 0 && issues.length === 0) { // Adjusted condition
        deps.error(deps.chalk.blue("No valid code blocks found to apply."));
        return deps.exit(finalExitCode); // Exit normally if no blocks and no issues
    }

    deps.error(
        deps.chalk.blue(`Applying changes for ${validBlocks.length} valid code block(s)...`)
    );
    const applyResult = await writeFiles(deps, validBlocks, DEFAULT_ENCODING);

    // Always log the results of the write attempt
    deps.log(formatWriteResults(deps, applyResult));

    if (applyResult.stats.failedWrites > 0) {
        finalExitCode = ExitCodes.ERROR; // Mark failure if any initial write failed
        deps.error(deps.chalk.red(`Errors occurred during the initial write operation. Cannot proceed to confirmation.`));
        // Optional: Attempt to revert partially successful writes? Or just exit?
        // Let's just exit here to keep it simple. Failed writes mean inconsistent state.
        return deps.exit(finalExitCode);
    }

    // Proceed to confirmation only if there were successful writes
    const successfulWrites = applyResult.writeResults.filter(r => r.success);
    if (successfulWrites.length > 0) {
        const response = await deps.prompt(deps.chalk.yellow(CONFIRMATION_PROMPT));
        const confirmation = response.trim().toLowerCase();

        if (confirmation === 'y' || confirmation === 'yes') {
            deps.log(deps.chalk.green(CHANGES_APPLIED_MESSAGE));
            // Keep finalExitCode as SUCCESS (or ERROR if analysis issues occurred earlier)
        } else {
            // User chose 'n', 'no', or anything else - revert
            const revertSuccessful = await revertChanges(
                deps,
                successfulWrites,
                applyResult.originalStates,
                DEFAULT_ENCODING
            );
            if (revertSuccessful) {
                deps.log(deps.chalk.green(CHANGES_REVERTED_MESSAGE));
                // Even if analysis had issues, user revert means operation completed as requested.
                // Override previous error status if revert was clean.
                finalExitCode = ExitCodes.SUCCESS;
            } else {
                deps.error(deps.chalk.red("Errors occurred during revert operation. Filesystem may be in an inconsistent state."));
                finalExitCode = ExitCodes.ERROR; // Revert failed, definitely an error state
            }
        }
    } else if (finalExitCode === ExitCodes.SUCCESS) {
        // No successful writes, and no analysis errors - means nothing to do/confirm.
        deps.log(deps.chalk.blue("No changes were applied."));
    }


    if (finalExitCode === ExitCodes.ERROR) {
        deps.error(deps.chalk.red(`Finished with errors.`));
    } else {
        // Only log success if no errors AND changes were applied or successfully reverted/none needed.
        if (successfulWrites.length > 0 || (validBlocks.length === 0 && issues.length === 0)) {
           deps.error(deps.chalk.green("Finished successfully."));
        } else if (issues.length > 0 && successfulWrites.length === 0) {
           // Had analysis issues but no blocks to apply anyway
           deps.error(deps.chalk.yellow("Finished with analysis issues, but no files were modified."));
        }
         // else case: Analysis issues, blocks found, but user reverted cleanly -> finalExitCode is SUCCESS already
    }

    deps.exit(finalExitCode);

  } catch (err: unknown) {
    // Catch unexpected errors
    deps.error(deps.chalk.red(`Unexpected error during execution: ${getErrorMessage(err)}`));
    deps.exit(ExitCodes.ERROR);
  }
};


const createDefaultDependencies = async (): Promise<Dependencies> => {
  const { parseArgs: nodeParseArgs } = await import("node:util");
  const { dirname: nodeDirname } = await import("node:path");
  const { stat, mkdir: nodeMkdir, unlink: nodeUnlink } = await import("node:fs/promises"); // Add unlink

  const readFile = (filePath: FilePath, _encoding: Encoding): Promise<FileContent> =>
    Bun.file(filePath).text();

  const writeFile = (filePath: FilePath, content: FileContent, _encoding: Encoding): Promise<void> =>
    Bun.write(filePath, content).then(() => {});

  const exists = async (path: FilePath): Promise<boolean> => {
      try {
          await stat(path); // Use stat to check existence
          return true;
      } catch (error: unknown) {
          // Specifically check for ENOENT (file not found) code
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
              return false;
          }
          // Re-throw other errors (e.g., permission issues)
          throw error;
      }
  };

   const mkdir = async (path: FilePath, options: { readonly recursive: boolean }): Promise<void> => {
      await nodeMkdir(path, options);
  }

  const readClipboard = async (): Promise<FileContent> => {
    try {
      // Use clipboardy for cross-platform clipboard access
      const content = await clipboardy.read();
      return content ?? ""; // Return empty string if clipboard is empty
    } catch (error) {
      // Provide a more informative error message
      throw new Error(`Failed to read from system clipboard: ${getErrorMessage(error)}. Ensure clipboard access is permitted and 'xclip' or 'wl-copy' (Linux), 'pbpaste' (macOS), or PowerShell (Windows) is available.`);
    }
  };

  return Object.freeze({
    readFile,
    writeFile,
    exists,
    mkdir,
    dirname: nodeDirname,
    readClipboard,
    log: console.log, // Use standard log for user output
    error: console.error, // Use standard error for progress messages and errors
    exit: process.exit, // Use standard process exit
    chalk: chalk,
    parseArgs: nodeParseArgs,
    hrtime: process.hrtime,
    prompt: prompt, // Use Bun's built-in prompt
    unlink: nodeUnlink, // Add unlink from fs/promises
  });
};

// Keep the main execution logic, no changes needed here
const main = async (): Promise<void> => {
  const deps = await createDefaultDependencies();
  try {
    await runApply(deps, Bun.argv);
  } catch (error: unknown) {
    // This catch should ideally not be reached if runApply handles errors properly
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
  writeFiles, // Keep exporting the main orchestrator
  formatAnalysisIssues,
  formatWriteResults,
  runApply, // Keep exporting the main entry point for potential programmatic use
  createDefaultDependencies,
  calculateLineChanges,
  prepareWriteOperation, // Export new functions if needed for testing/extension
  performSingleWrite,
  revertChanges,
  ensureDirectoryExists,
};
```