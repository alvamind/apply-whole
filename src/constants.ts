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