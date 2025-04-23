// src/constants.ts
import type { ParseArgsConfig } from "node:util";
import type { Encoding } from "./types";

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