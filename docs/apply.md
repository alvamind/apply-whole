Okay, let's implement these changes.

1.  **Spinner:** We'll add simple text-based status updates using `deps.error` for start/end of operations instead of a complex animated spinner to maintain simplicity and avoid external libraries.
2.  **Skip Linter Flag:** Added `--no-lint` flag.
3.  **Linter Errors/Warnings:** Modified `runLinter` and reporting to count both.
4.  **Linter Check Timing:** Moved the final check before the confirmation prompt.

```typescript
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
  --no-lint            Skip TypeScript checks before and after applying changes.
`;
export const ARGS_CONFIG: ParseArgsConfig = {
  options: {
    input: { type: "string", short: "i" },
    help: { type: "boolean", short: "h" },
    "no-lint": { type: "boolean", default: false }, // Added no-lint flag
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

// Status Messages
export const READING_INPUT_START = "Reading input...";
export const READING_INPUT_DONE = "Input read.";
export const ANALYSIS_START = "Analyzing markdown content...";
export const ANALYSIS_DONE = "Analysis complete.";
export const APPLYING_CHANGES_START = (count: number): string => `Applying changes for ${count} valid code block(s)...`;
export const APPLYING_CHANGES_DONE = "File operations complete.";
export const REVERTING_DONE = "Revert operation finished.";

// Linter related messages
export const LINTER_COMMAND: ReadonlyArray<string> = ["bun", "tsc", "--noEmit", "--pretty", "false"]; // Added pretty: false for easier parsing
export const LINTER_CHECK_START_MSG = "Running TypeScript check...";
export const LINTER_CHECK_COMPLETE_MSG = "TypeScript check complete.";
export const LINTER_CHECK_FAILED_MSG = "Warning: Failed to run TypeScript check";
export const LINTER_CHECK_SKIPPED_MSG = "TypeScript check skipped.";
export const LINTER_RESULTS_MSG = (errors: number, warnings: number): string =>
  `TypeScript - Errors: ${errors}, Warnings: ${warnings}`;
export const LINTER_CHANGE_MSG = (
    errorChange: number,
    warningChange: number,
    errorColor: (s: string) => string,
    warningColor: (s: string) => string
): string =>
    `Change - Errors: ${errorColor(errorChange > 0 ? `+${errorChange}` : String(errorChange))}, Warnings: ${warningColor(warningChange > 0 ? `+${warningChange}` : String(warningChange))}`;

export const LINTER_ERROR_LINE_REGEX = /error TS\d+:/i;
export const LINTER_WARNING_LINE_REGEX = /warning TS\d+:/i; // Adjust if tsc uses different warning format

```

```typescript
// src/types.ts
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
    readonly "no-lint"?: boolean; // Added no-lint
  };
}

export interface ParsedArgsResult {
  readonly inputFile: FilePath | null;
  readonly useClipboard: boolean;
  readonly showHelp: boolean;
  readonly skipLinter: boolean; // Added skipLinter
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

// --- Linter Result ---
export interface LinterResult {
    readonly errors: number;
    readonly warnings: number;
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
  readonly spawn: typeof Bun.spawn;
  readonly runLinter: () => Promise<LinterResult | null>; // Updated return type
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
export type InputDeps = Pick<Dependencies, "readFile" | "readClipboard" | "error" | "chalk"> & ErrorExitDeps;
export type FormatDeps = Pick<Dependencies, "chalk">;
export type DirectoryDeps = Pick<Dependencies, "exists" | "mkdir" | "dirname">;
export type WriteFileDeps = Pick<Dependencies, "writeFile" | "readFile"> & DirectoryDeps;
export type WriteProcessDeps = WriteFileDeps & Pick<Dependencies, "hrtime" | "exists" | "error" | "chalk">; // Added error/chalk for status
export type RevertDeps = Pick<Dependencies, "writeFile" | "unlink" | "log" | "error" | "chalk"> & ErrorExitDeps; // Added error/chalk for status
export type LintingDeps = Pick<Dependencies, "runLinter" | "error" | "chalk">;
export type RunApplyDeps = Dependencies & LintingDeps;

```

```typescript
// src/core.ts
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
  LINTER_COMMAND,
  LINTER_CHECK_START_MSG,
  LINTER_CHECK_COMPLETE_MSG,
  LINTER_CHECK_FAILED_MSG,
  LINTER_RESULTS_MSG,
  LINTER_CHANGE_MSG,
  LINTER_ERROR_LINE_REGEX,
  LINTER_WARNING_LINE_REGEX,
  LINTER_CHECK_SKIPPED_MSG,
  READING_INPUT_START,
  READING_INPUT_DONE,
  ANALYSIS_START,
  ANALYSIS_DONE,
  APPLYING_CHANGES_START,
  APPLYING_CHANGES_DONE,
  REVERTING_DONE,
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
  LintingDeps,
  RunApplyDeps,
  LinterResult,
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
    const skipLinter = parsed.values["no-lint"] ?? false; // Get skipLinter flag

    if (showHelp) {
      deps.log(HELP_MESSAGE);
      return deps.exit(ExitCodes.SUCCESS);
    }
    return {
      inputFile,
      useClipboard: !inputFile,
      showHelp: false,
      skipLinter, // Return skipLinter flag
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
  deps.error(deps.chalk.blue(READING_INPUT_START)); // Use status message
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
    const content = await readFileOrClipboard();
    deps.error(deps.chalk.blue(READING_INPUT_DONE)); // Use status message
    return content;
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
    // Analysis logic remains the same...
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
                        currentBlockPath = ""; // Path not found immediately
                    }
                } else {
                    currentBlockPath = ""; // Path not found and no next line
                }
            } else { // End of a block
                inCodeBlock = false;
                if (currentBlockPath) { // Only add block if path was found
                    const contentEnd = i;
                    const blockContent = lines.slice(contentStart, contentEnd).join('\n');
                    validBlocks.push({
                        filePath: currentBlockPath,
                        fileContent: blockContent,
                        startLineNumber: currentBlockStart + 1 // Line number of opening ```
                    });
                } else { // No path found for this block
                    issues.push({
                        lineNumber: currentBlockStart + 1,
                        lineContent: lines[currentBlockStart] ?? "",
                        message: "Code block found, but missing file path comment (e.g., `// path/to/file.ext`) on the start line or the next line.",
                    });
                }
                currentBlockPath = ""; // Reset for next block
            }
        }
    }

    // Check if the file ended while still inside a code block
    if (inCodeBlock) {
        issues.push({
            lineNumber: currentBlockStart + 1,
            lineContent: lines[currentBlockStart] ?? "",
            message: "Unclosed code block detected. Found start delimiter '```' but no matching end delimiter.",
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
  // Write logic remains the same...
  let oldContent: FileContent | null = null;
  let originallyExisted = false;
  try {
    await ensureDirectoryExists(deps, block.filePath);
    originallyExisted = await deps.exists(block.filePath);
    if (originallyExisted) {
        try {
            oldContent = await deps.readFile(block.filePath, encoding);
        } catch (readError: unknown) {
             console.warn(`Warning: Could not read existing file ${block.filePath}, will overwrite. Error: ${getErrorMessage(readError)}`);
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
  deps.error(deps.chalk.blue(APPLYING_CHANGES_START(blocks.length)));
  const startTime = deps.hrtime();
  const originalStates = await Promise.all(blocks.map(async (block) => {
    let originalContent: FileContent | null = null;
    const fileExists = await deps.exists(block.filePath);
    if (fileExists) {
      try {
        originalContent = await deps.readFile(block.filePath, encoding);
      } catch (error) {
        console.warn(`Warning: Failed to read original content of ${block.filePath}: ${getErrorMessage(error)}`);
        originalContent = null;
      }
    }
    return { block, originalContent, originallyExisted: fileExists && originalContent !== null };
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

   deps.error(deps.chalk.blue(APPLYING_CHANGES_DONE));
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
  // Formatting remains the same...
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

  for (const result of successfulWriteResults) {
      const originalState = originalStates.find(os => os.block.filePath === result.filePath);
      if (!originalState) {
          deps.error(deps.chalk.red(`   Error: Cannot find original state for ${result.filePath} to revert.`));
          allRevertedSuccessfully = false;
          continue;
      }

      try {
          if (originalState.originallyExisted) {
              if (originalState.originalContent !== null) {
                  await deps.writeFile(result.filePath, originalState.originalContent, encoding);
                  deps.log(REVERT_ACTION_MESSAGE(result.filePath, "restored"));
              } else {
                  try {
                      await deps.unlink(result.filePath);
                       deps.log(REVERT_ACTION_MESSAGE(result.filePath, "deleted (original content was null/unreadable)"));
                  } catch (unlinkError) {
                       deps.error(deps.chalk.red(`   Error deleting file ${result.filePath} during revert: ${getErrorMessage(unlinkError)}`));
                       allRevertedSuccessfully = false;
                  }
              }
          } else {
              await deps.unlink(result.filePath);
              deps.log(REVERT_ACTION_MESSAGE(result.filePath, "deleted"));
          }
      } catch (revertError: unknown) {
          deps.error(deps.chalk.red(REVERT_ERROR_MESSAGE(result.filePath, getErrorMessage(revertError))));
          allRevertedSuccessfully = false;
      }
  }
  deps.error(deps.chalk.yellow(REVERTING_DONE)); // Status message
  return allRevertedSuccessfully;
};

const confirmAndPotentiallyRevert = async (
    deps: Dependencies,
    applyResult: ApplyResult,
    encoding: Encoding,
    skipLinter: boolean // Pass skipLinter flag
): Promise<{ shouldKeepChanges: boolean; finalExitCode: number }> => {
    const successfulWrites = applyResult.writeResults.filter(r => r.success);
    // No changes made or only failures occurred, skip confirmation
    if (successfulWrites.length === 0) {
        return {
            shouldKeepChanges: false,
            finalExitCode: applyResult.stats.failedWrites > 0 ? ExitCodes.ERROR : ExitCodes.SUCCESS
        };
    }

    // --- Final Linter Check (Moved Here) ---
    let finalLintResult: LinterResult | null = null;
    if (!skipLinter) {
        deps.error(deps.chalk.blue(LINTER_CHECK_START_MSG));
        finalLintResult = await deps.runLinter();
        if (finalLintResult) {
            deps.error(deps.chalk.blue(`${LINTER_CHECK_COMPLETE_MSG} ${LINTER_RESULTS_MSG(finalLintResult.errors, finalLintResult.warnings)}`));
        } else {
            deps.error(deps.chalk.yellow(LINTER_CHECK_FAILED_MSG));
        }
    } else {
        deps.error(deps.chalk.gray(LINTER_CHECK_SKIPPED_MSG));
    }
     // Add a newline for cleaner prompt display after lint results
     deps.error("");


    // --- Confirmation Prompt ---
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
        // --- Revert ---
        const revertSuccessful = await revertChanges(
            deps,
            successfulWrites,
            applyResult.originalStates,
            encoding
        );
        if (revertSuccessful) {
            deps.log(deps.chalk.green(CHANGES_REVERTED_MESSAGE));
            return { shouldKeepChanges: false, finalExitCode: ExitCodes.SUCCESS };
        } else {
            deps.error(deps.chalk.red("Errors occurred during revert operation. Filesystem may be in an inconsistent state."));
            return { shouldKeepChanges: false, finalExitCode: ExitCodes.ERROR };
        }
    }
};

// Helper function to report linter results (now handles object)
const reportLinterResult = (deps: LintingDeps, label: string, result: LinterResult | null): void => {
    if (result === null) {
        deps.error(deps.chalk.yellow(`${label}: ${LINTER_CHECK_FAILED_MSG}`));
    } else {
        deps.error(deps.chalk.blue(`${label}: ${LINTER_RESULTS_MSG(result.errors, result.warnings)}`));
    }
};

const runApply = async (
  deps: RunApplyDeps,
  argv: ReadonlyArray<string>
): Promise<void> => {
  let finalExitCode: number = ExitCodes.SUCCESS;
  let initialLintResult: LinterResult | null = null;
  let analysisHadIssues = false;
  let changesAppliedOrReverted = false; // Track if any action requiring final lint occurred

  try {
    const args = parseCliArguments(deps, argv);

    // --- Initial Linter Check ---
    if (!args.skipLinter) {
        deps.error(deps.chalk.blue(LINTER_CHECK_START_MSG));
        initialLintResult = await deps.runLinter();
        if (initialLintResult) {
             deps.error(deps.chalk.blue(`${LINTER_CHECK_COMPLETE_MSG} ${LINTER_RESULTS_MSG(initialLintResult.errors, initialLintResult.warnings)}`));
        } else {
             deps.error(deps.chalk.yellow(LINTER_CHECK_FAILED_MSG));
        }
    } else {
         deps.error(deps.chalk.gray(LINTER_CHECK_SKIPPED_MSG));
    }

    const content = await getInputContent(deps, args, DEFAULT_ENCODING);

    // --- Analysis ---
    deps.error(deps.chalk.blue(ANALYSIS_START));
    const { validBlocks, issues } = analyzeMarkdownContent(content);
    deps.error(deps.chalk.blue(ANALYSIS_DONE));

    if (issues.length > 0) {
      analysisHadIssues = true;
      deps.error(deps.chalk.yellow("\nAnalysis Issues Found:"));
      formatAnalysisIssues(deps, issues).forEach(issue => deps.error(issue));
      finalExitCode = ExitCodes.ERROR; // Mark exit code as error due to analysis issues
      if (validBlocks.length === 0) {
         deps.error(deps.chalk.red("\nNo valid code blocks extracted due to analysis issues. Aborting operation."));
         // No changes applied, exit early
         return deps.exit(finalExitCode);
      }
      deps.error(deps.chalk.yellow("\nAttempting to process any valid blocks found despite issues..."));
    } else if (validBlocks.length > 0) {
      deps.error(deps.chalk.green("No analysis issues found."));
    }

    if (validBlocks.length === 0 && !analysisHadIssues) {
        deps.error(deps.chalk.blue("No valid code blocks found to apply."));
        // No changes to apply, final lint count is same as initial (if run)
    } else if (validBlocks.length > 0) {
        // --- Write Files ---
        const applyResult = await writeFiles(deps, validBlocks, DEFAULT_ENCODING);
        deps.log(formatWriteResults(deps, applyResult)); // Log results to stdout

        // --- Confirm / Revert / Final Lint ---
        // Pass skipLinter flag down
        const confirmResult = await confirmAndPotentiallyRevert(deps, applyResult, DEFAULT_ENCODING, args.skipLinter);
        changesAppliedOrReverted = true; // An action was taken or reverted

        // Update finalExitCode based on confirmation/revert result, but keep ERROR if analysis had issues
        if (finalExitCode !== ExitCodes.ERROR) {
            finalExitCode = confirmResult.finalExitCode;
        } else if (confirmResult.finalExitCode === ExitCodes.ERROR) {
            // If confirmation/revert also failed, ensure exit code remains ERROR
            finalExitCode = ExitCodes.ERROR;
        }
    }

    // --- Final Status Message ---
    // We don't report the final linter results here anymore as they are shown before the prompt
    // If no action was taken (no valid blocks or analysis failure with no blocks), we just report the initial state.
    if (finalExitCode === ExitCodes.ERROR) {
      deps.error(deps.chalk.red(`Finished with issues.`));
    } else if (!changesAppliedOrReverted && !analysisHadIssues) {
        deps.error(deps.chalk.blue("Finished. No changes were applied or needed."));
    } else {
        // Success includes successful apply or successful revert
        deps.error(deps.chalk.green("Finished."));
    }
    deps.exit(finalExitCode);

  } catch (err: unknown) {
    // Catch unexpected errors during the main flow
    deps.error(deps.chalk.red(`Unexpected error: ${getErrorMessage(err)}`));
    // Don't run final linter here, as state is unknown
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
      throw new Error(`Failed to read from clipboard. Ensure 'clipboardy' is installed and system dependencies (like xclip/xsel on Linux, pbcopy/pbpaste on macOS) are met. Original error: ${getErrorMessage(error)}`);
    }
  };

  const prompt = async (message: string): Promise<string> => {
    process.stdout.write(message);
    return new Promise((resolve) => {
        if (process.stdin.isTTY) {
             process.stdin.resume();
             process.stdin.setEncoding('utf8');
             process.stdin.once('data', (data: Buffer) => {
                 process.stdin.pause();
                 resolve(data.toString().trim());
             });
        } else {
            console.error("\nWarning: Non-interactive terminal detected. Cannot prompt for confirmation. Assuming 'no'.");
            resolve('n');
        }
    });
  };

  const unlink = async (path: FilePath): Promise<void> => {
    await nodeUnlink(path);
  };

  // Updated Linter implementation using Bun.spawn
  const runLinter = async (): Promise<LinterResult | null> => {
    try {
      const proc = Bun.spawn(LINTER_COMMAND, {
        stdout: "pipe",
        stderr: "pipe",
      });
      // Use text() for cleaner async handling
      const stdout = await proc.stdout.text();
      const stderr = await proc.stderr.text();
      await proc.exited;

      const output = stdout + stderr; // Combine both streams for full output analysis
      const lines = output.split(NEWLINE_REGEX);

      const errors = lines.filter(line => LINTER_ERROR_LINE_REGEX.test(line)).length;
      const warnings = lines.filter(line => LINTER_WARNING_LINE_REGEX.test(line)).length;

      return { errors, warnings };

    } catch (error) {
      console.error(chalk.yellow(`${LINTER_CHECK_FAILED_MSG}: ${getErrorMessage(error)}`));
      return null;
    }
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
    unlink,
    spawn: Bun.spawn,
    runLinter,
  });
};

const main = async (): Promise<void> => {
  const deps = await createDefaultDependencies();
  try {
    await runApply(deps, Bun.argv);
  } catch (error: unknown) {
    deps.error(deps.chalk.red(`Unhandled error in main execution: ${getErrorMessage(error)}`));
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
```