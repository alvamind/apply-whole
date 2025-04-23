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
src/constants.ts
src/core.ts
src/types.ts
```

# Files

## File: src/constants.ts
````typescript
// src/constants.ts
import type { ParseArgsConfig } from "node:util";
import type { Encoding } from "./types";
export const DEFAULT_ENCODING: Encoding = "utf-8";
// Regex specifically for validating the START line of a code block during analysis
// Allows optional language tag, requires // path comment
export const CODE_BLOCK_START_LINE_REGEX: RegExp =
  /^```(?:[a-z]+)?\s*\/\/\s*(?<path>[^\r\n]+)\s*$/i; // Case-insensitive, checks whole line
// Regex to identify any line starting with ``` as a potential delimiter
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
  allowPositionals: false, // No positional arguments allowed
  strict: true, // Throw on unknown args
};
export const ExitCodes = {
  SUCCESS: 0,
  ERROR: 1, // Used for any failure (analysis issues, write errors, general errors)
  INVALID_ARGS: 2,
  // ANALYSIS_FAILED: 3, // Removed - Use ERROR instead
} as const;
````

## File: src/core.ts
````typescript
// src/core.ts
import type {
  // ParsedArgs removed, using ParsedArgsResult instead
  FilePath,
  FileContent,
  CodeBlock,
  AnalysisResult,
  AnalysisIssue,
  DelimiterLine,
  WriteResult,
  ProcessingStats,
  ApplyResult,
  Dependencies,
  Encoding,
  Nanoseconds,
  Milliseconds,
  // ExitCode, // Removed - Use number directly or ExitCodes constant
  // LineNumber, // Removed - Only used within types.ts definitions
  ParsedArgsResult, // Use the more specific result type
  ParsedArgsValues, // Used in parseCliArguments
} from "./types";
import {
  DEFAULT_ENCODING,
  CODE_BLOCK_START_LINE_REGEX,
  ANY_CODE_BLOCK_DELIMITER_REGEX,
  HELP_MESSAGE,
  ARGS_CONFIG,
  ExitCodes,
} from "./constants";
// --- Pure Helper Functions ---
const nanosecondsToMilliseconds = (diff: Nanoseconds): Milliseconds =>
  (diff[0] * 1e9 + diff[1]) / 1e6;
const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
// --- Core Logic Functions (using Dependency Injection) ---
// Add chalk to Pick
const parseCliArguments = (
  deps: Pick<Dependencies, "parseArgs" | "error" | "log" | "exit" | "chalk">,
  argv: ReadonlyArray<string>
): ParsedArgsResult => {
  try {
    // Use ParsedArgsValues type here
    const parsed: ParsedArgsValues = deps.parseArgs({ ...ARGS_CONFIG, args: argv.slice(2) });
    const showHelp = parsed.values.help ?? false;
    const inputFile = parsed.values.input ?? null;
    if (showHelp) {
      deps.log(HELP_MESSAGE);
      return deps.exit(ExitCodes.SUCCESS);
    }
    const useClipboard = !inputFile;
    // Check for conflict - use deps.chalk here
    if (useClipboard && showHelp) {
         deps.error(deps.chalk.red("Cannot use clipboard and show help simultaneously."));
         deps.log(HELP_MESSAGE);
         return deps.exit(ExitCodes.INVALID_ARGS);
    }
    return {
      inputFile,
      useClipboard,
      showHelp, // Will be false if we reach here
    };
  } catch (err: unknown) {
    // Use deps.chalk here
    deps.error(deps.chalk.red(`Invalid arguments: ${getErrorMessage(err)}`));
    deps.log(HELP_MESSAGE);
    return deps.exit(ExitCodes.INVALID_ARGS);
  }
};
// Add log to Pick
const getInputContent = async (
  deps: Pick<Dependencies, "readFile" | "readClipboard" | "chalk" | "error" | "exit" | "log">,
  args: ParsedArgsResult, // Use the correct type
  encoding: Encoding
): Promise<FileContent> => {
  const sourceDescription = args.inputFile
    ? `file: ${deps.chalk.cyan(args.inputFile)}`
    : "clipboard";
  // Use deps.log here
  deps.log(deps.chalk.blue(`Reading from ${sourceDescription}...`));
  try {
    if (args.inputFile) {
      return await deps.readFile(args.inputFile, encoding);
    }
    if (args.useClipboard) {
      const content = await deps.readClipboard();
       if (!content || content.trim().length === 0) {
         throw new Error("Clipboard is empty or contains only whitespace.");
       }
      return content;
    }
    throw new Error("No input source specified (file or clipboard).");
  } catch (error: unknown) {
    const baseMsg = `Failed to read from ${sourceDescription}`;
    const specificError = getErrorMessage(error);
    deps.error(deps.chalk.red(`${baseMsg}: ${specificError}`));
    if (args.inputFile && specificError.includes('ENOENT')) {
       deps.error(deps.chalk.yellow(`Hint: Ensure the file '${args.inputFile}' exists and has read permissions.`));
    } else if (args.useClipboard) {
       deps.error(deps.chalk.yellow(`Hint: Ensure clipboard access is allowed and it contains text.`));
    }
    return deps.exit(ExitCodes.ERROR);
  }
};
// --- Analysis Function ---
const analyzeMarkdownContent = (
    markdownContent: FileContent
): AnalysisResult => {
    const lines = markdownContent.split(/\r?\n/);
    const issues: AnalysisIssue[] = [];
    const validBlocks: CodeBlock[] = [];
    const delimiterLines: DelimiterLine[] = lines.reduce(
        (acc: DelimiterLine[], lineContent, index) => {
            if (ANY_CODE_BLOCK_DELIMITER_REGEX.test(lineContent.trimStart())) {
                acc.push({ lineNumber: index + 1, content: lineContent });
            }
            return acc;
        },
        []
    );
    // Check for odd number of delimiters
    if (delimiterLines.length % 2 !== 0) {
        // Add explicit check for lastDelimiter existence for type safety
        const lastDelimiter = delimiterLines[delimiterLines.length - 1];
        if (lastDelimiter) { // Check ensures lastDelimiter is not undefined
             issues.push({
                lineNumber: lastDelimiter.lineNumber,
                lineContent: lastDelimiter.content,
                message: "Found an odd number of '```' delimiters. Blocks may be incomplete or incorrectly matched.",
            });
        } else {
             // This case should technically be impossible if length % 2 !== 0,
             // but handles edge case where length might be 0 (though % 2 would be 0)
             // Or if TS inference is being extremely strict.
             issues.push({
                 lineNumber: lines.length, // Report end of file?
                 lineContent: "",
                 message: "Internal Error: Detected odd number of delimiters but couldn't identify the last one.",
             });
        }
    }
    for (let i = 0; i < delimiterLines.length - 1; i += 2) {
        const startLine = delimiterLines[i];
        const endLine = delimiterLines[i + 1];
        // Add guard for startLine and endLine existence
        if (startLine && endLine) {
            const trimmedStartLineContent = startLine.content.trim();
            const match = trimmedStartLineContent.match(CODE_BLOCK_START_LINE_REGEX);
            // Use bracket notation ['path']
            if (!match?.groups?.['path']) {
                issues.push({
                    lineNumber: startLine.lineNumber,
                    lineContent: startLine.content,
                    message: `Invalid code block start tag format. Expected: \`\`\`[lang] // path/to/file.ext\``,
                });
            } else {
                // Use bracket notation ['path'] and ensure groups exists
                const filePath = match.groups['path'].trim();
                const codeContent = lines
                    .slice(startLine.lineNumber, endLine.lineNumber - 1)
                    .join('\n');
                validBlocks.push({
                    filePath: filePath,
                    fileContent: codeContent,
                    startLineNumber: startLine.lineNumber,
                });
            }
        } else {
             // Should not happen based on loop condition, but guard added
             issues.push({
                 lineNumber: delimiterLines[i]?.lineNumber ?? (lines.length > 0 ? lines.length : 0), // Best guess line number
                 lineContent: delimiterLines[i]?.content ?? "",
                 message: "Internal Error: Missing start or end delimiter line within loop.",
             });
        }
    }
    return {
        validBlocks: Object.freeze(validBlocks),
        issues: Object.freeze(issues),
    };
};
// --- File Writing Functions ---
// EnsureDirectoryExists and performWrite remain the same structure
// but ensure deps signatures match full Dependencies if needed, or use Pick
const ensureDirectoryExists = async (
  deps: Pick<Dependencies, "exists" | "mkdir" | "dirname">, // Keep Pick specific
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
const performWrite = async (
  deps: Pick<Dependencies, "writeFile" | "exists" | "mkdir" | "dirname">, // Keep Pick specific
  block: CodeBlock,
  encoding: Encoding
): Promise<WriteResult> => {
  try {
    await ensureDirectoryExists(deps, block.filePath);
    // Pass encoding even if implementation might ignore it
    await deps.writeFile(block.filePath, block.fileContent, encoding);
    return { filePath: block.filePath, success: true };
  } catch (error: unknown) {
    return {
      filePath: block.filePath,
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
};
const writeFiles = async (
  // Keep Pick specific, hrtime was missing before
  deps: Pick<Dependencies, "writeFile" | "exists" | "mkdir" | "dirname" | "hrtime">,
  blocks: ReadonlyArray<CodeBlock>,
  encoding: Encoding
): Promise<ApplyResult> => {
  const startTime = deps.hrtime();
  const writeResults: WriteResult[] = [];
   for (const block of blocks) {
     const result = await performWrite(deps, block, encoding);
     writeResults.push(result);
   }
  const durationMs = nanosecondsToMilliseconds(deps.hrtime(startTime));
  const successfulWrites = writeResults.filter((r) => r.success).length;
  const failedWrites = writeResults.length - successfulWrites;
  const stats: ProcessingStats = {
    totalAttempted: blocks.length,
    successfulWrites,
    failedWrites,
    durationMs,
  };
  return { writeResults: Object.freeze(writeResults), stats };
};
// --- Output Formatting ---
// formatAnalysisIssues and formatWriteResults remain the same structure
// Ensure deps signatures match full Dependencies if needed, or use Pick
const formatAnalysisIssues = (
    deps: Pick<Dependencies, "chalk">, // Pick only chalk
    issues: ReadonlyArray<AnalysisIssue>
): string[] => {
    const { chalk } = deps;
    return issues.map(issue =>
        `${chalk.yellow(`[Line ${issue.lineNumber}]`)}: ${issue.message}` +
        `\n   ${chalk.gray(issue.lineContent.trim())}`
    );
}
const formatWriteResults = (
  deps: Pick<Dependencies, "chalk">, // Pick only chalk
  { writeResults, stats }: ApplyResult
): string => {
  const { chalk } = deps;
  const lines: string[] = [];
  writeResults.forEach((result) => {
    const icon = result.success ? chalk.green("✔") : chalk.red("✖");
    const status = result.success ? "Written" : "Failed ";
    lines.push(`${icon} ${status}: ${chalk.cyan(result.filePath)}`);
    if (!result.success && result.error) {
      lines.push(`   ${chalk.red(`└─ Error: ${getErrorMessage(result.error)}`)}`);
    }
  });
  lines.push(`\n${chalk.bold("Summary:")}`);
  lines.push(
    `  Attempted: ${chalk.blue(stats.totalAttempted)} file(s) ` +
    `(${chalk.green(stats.successfulWrites + " succeeded")}, ` +
    `${chalk.red(stats.failedWrites + " failed")})`
  );
  lines.push(`  Duration: ${chalk.yellow(stats.durationMs.toFixed(2) + "ms")}`);
  return lines.join("\n");
};
// --- Main Application Logic ---
const runApply = async (
  deps: Dependencies, // Use full Dependencies here
  argv: ReadonlyArray<string>
): Promise<void> => {
  const args = parseCliArguments(deps, argv);
  if (args.showHelp) return;
  const markdownContent = await getInputContent(deps, args, DEFAULT_ENCODING);
  deps.log(deps.chalk.blue("Analyzing markdown content..."));
  const analysisResult = analyzeMarkdownContent(markdownContent);
  const hadAnalysisIssues = analysisResult.issues.length > 0;
  if (hadAnalysisIssues) {
      deps.error(deps.chalk.yellow.bold("\nAnalysis Issues Found:"));
      // Pass only necessary deps to formatting function
      const issueLines = formatAnalysisIssues({ chalk: deps.chalk }, analysisResult.issues);
      issueLines.forEach(line => deps.error(line));
      deps.log(deps.chalk.cyan("\nAttempting to process any valid blocks found..."));
  } else {
       deps.log(deps.chalk.green("Analysis complete. No issues found."));
  }
  const blocksToWrite = analysisResult.validBlocks;
  const validBlockCount = blocksToWrite.length;
  if (validBlockCount === 0) {
    const message = hadAnalysisIssues
        ? "No valid code blocks were extracted due to analysis issues."
        : "No valid code blocks found to apply.";
    deps.log(deps.chalk.yellow(`\n${message}`));
    return deps.exit(hadAnalysisIssues ? ExitCodes.ERROR : ExitCodes.SUCCESS);
  }
  deps.log(deps.chalk.blue(`Applying changes for ${validBlockCount} valid code block(s)...`));
  // Pass necessary deps to writeFiles
  const writeResult = await writeFiles(
      { // Explicitly pass picked dependencies
          writeFile: deps.writeFile,
          exists: deps.exists,
          mkdir: deps.mkdir,
          dirname: deps.dirname,
          hrtime: deps.hrtime
      },
      blocksToWrite,
      DEFAULT_ENCODING
  );
  // Pass necessary deps to formatWriteResults
  const writeOutput = formatWriteResults({ chalk: deps.chalk }, writeResult);
  deps.log(writeOutput);
  const hadWriteErrors = writeResult.stats.failedWrites > 0;
  const finalExitCode = (hadAnalysisIssues || hadWriteErrors) ? ExitCodes.ERROR : ExitCodes.SUCCESS;
  if (finalExitCode !== ExitCodes.SUCCESS) {
       const errorSummaryParts = [];
       if (hadAnalysisIssues) errorSummaryParts.push(`${analysisResult.issues.length} analysis issue(s)`);
       if (hadWriteErrors) errorSummaryParts.push(`${writeResult.stats.failedWrites} write error(s)`);
      deps.error(deps.chalk.red.bold(`\nFinished with ${errorSummaryParts.join(' and ')}.`));
  } else {
      deps.log(deps.chalk.green("\nFinished successfully."));
  }
  return deps.exit(finalExitCode);
};
// --- Dependency Implementation ---
const createDefaultDependencies = async (): Promise<Dependencies> => {
  const { default: chalk } = await import("chalk");
  const { parseArgs: nodeParseArgs } = await import("node:util");
  const { dirname: nodeDirname } = await import("node:path");
  const { stat, mkdir: nodeMkdir } = await import("node:fs/promises");
  // Add underscore prefix to unused encoding parameters
  const readFile = (filePath: FilePath, _encoding: Encoding): Promise<FileContent> =>
    Bun.file(filePath).text();
  // Add underscore prefix to unused encoding parameters
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
      // Add ts-expect-error comment for potential Bun type issue
      // @ts-expect-error Bun clipboard types might be missing/incomplete
      const content = await Bun.clipboard.readText();
      return content ?? "";
    } catch (error) {
      throw new Error(`Failed to read from clipboard: ${getErrorMessage(error)}`);
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
    exit: process.exit, // Use process.exit directly
    chalk: chalk,
    parseArgs: nodeParseArgs, // Assign the imported function
    hrtime: process.hrtime,
  });
};
// --- Entry Point ---
const main = async (): Promise<void> => {
  try {
    const deps = await createDefaultDependencies();
    await runApply(deps, process.argv);
  } catch (error: unknown) {
    const chalk = await import("chalk").then(m => m.default);
    console.error(
      `\n${chalk.red('Fatal Error:')} ${getErrorMessage(error)}`
    );
    process.exit(ExitCodes.ERROR);
  }
};
if (import.meta.main) {
  main();
}
// Export core functions for potential testing or programmatic use
export {
  parseCliArguments,
  getInputContent,
  analyzeMarkdownContent,
  writeFiles,
  formatAnalysisIssues,
  formatWriteResults,
  runApply,
  createDefaultDependencies,
};
````

## File: src/types.ts
````typescript
// src/types.ts
import type { ChalkInstance } from "chalk";
// Remove ParsedResults import
import type { ParseArgsConfig } from "node:util"; // Keep ParseArgsConfig
// --- Primitive Aliases ---
export type FilePath = string;
export type FileContent = string;
export type ErrorMessage = string;
export type Milliseconds = number;
export type Nanoseconds = [number, number]; // From process.hrtime
export type ExitCode = number;
export type Encoding = "utf-8"; // Or other encodings if needed
export type LineNumber = number;
// --- Core Data Structures ---
export interface CodeBlock {
  readonly filePath: FilePath;
  readonly fileContent: FileContent;
  readonly startLineNumber: LineNumber;
}
// --- Analysis Types ---
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
// --- Command Line Arguments ---
// Define the expected structure returned by parseArgs based on ARGS_CONFIG
export interface ParsedArgsValues {
  readonly values: {
    readonly input?: string;
    readonly help?: boolean;
    // Add other potential options here if ARGS_CONFIG changes
  };
  // Include other properties like 'positionals' if needed, though we avoid them
  // readonly positionals: readonly string[];
}
export interface ParsedArgsResult {
  readonly inputFile: FilePath | null;
  readonly useClipboard: boolean;
  readonly showHelp: boolean;
}
// --- I/O Results ---
export interface WriteResult {
  readonly filePath: FilePath;
  readonly success: boolean;
  readonly error?: Error;
}
// --- Execution Summary ---
export interface ProcessingStats {
  readonly totalAttempted: number;
  readonly successfulWrites: number;
  readonly failedWrites: number;
  readonly durationMs: Milliseconds;
}
export interface ApplyResult {
  readonly writeResults: ReadonlyArray<WriteResult>;
  readonly stats: ProcessingStats;
}
// --- Dependency Injection Interface ---
export interface Dependencies {
  // Filesystem & I/O
  readonly readFile: (filePath: FilePath, encoding: Encoding) => Promise<FileContent>;
  readonly writeFile: (filePath: FilePath, content: FileContent, encoding: Encoding) => Promise<void>;
  readonly exists: (path: FilePath) => Promise<boolean>;
  readonly mkdir: (path: FilePath, options: { readonly recursive: boolean }) => Promise<void>;
  readonly dirname: (path: FilePath) => FilePath;
  readonly readClipboard: () => Promise<FileContent>;
  // Console & Process
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
  readonly exit: (code: number) => never; // Use number type directly for exit code
  // Utilities
  readonly chalk: ChalkInstance;
  // Use the specific type we defined
  readonly parseArgs: <T extends ParseArgsConfig>(config: T) => ParsedArgsValues;
  readonly hrtime: (time?: Nanoseconds) => Nanoseconds;
}
````
