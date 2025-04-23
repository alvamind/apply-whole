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
export const READING_FILE_START = (path: FilePath): string => `Reading from file: ${path}...`;
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
