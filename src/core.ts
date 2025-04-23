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
  ApplyResult,
  Dependencies,
  Encoding,
  Nanoseconds,
  Milliseconds,
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
      deps.log(HELP_MESSAGE); // Show help message on stdout
      return deps.exit(ExitCodes.SUCCESS);
    }

    const useClipboard = !inputFile;

    // Check for conflict - use deps.chalk here
    if (useClipboard && showHelp) {
         deps.error(deps.chalk.red("Cannot use clipboard and show help simultaneously."));
         deps.error(HELP_MESSAGE);
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
    deps.error(HELP_MESSAGE); // Show help message on stderr for errors
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
  // Use deps.error here for logging/status updates
  deps.error(deps.chalk.blue(`Reading from ${sourceDescription}...`));

  try {
    if (args.inputFile) {
      try {
        return await deps.readFile(args.inputFile, encoding);
      } catch (fileError: unknown) {
        const baseMsg = `Failed to read from ${sourceDescription}`;
        const specificError = getErrorMessage(fileError);
        deps.error(deps.chalk.red(`${baseMsg}: ${specificError}`));
        
        if (specificError.includes('ENOENT')) {
          deps.error(deps.chalk.yellow(`Hint: Ensure the file '${args.inputFile}' exists`));
        }
        
        process.exit(ExitCodes.ERROR); // Force exit with correct code
      }
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
    
    if (args.useClipboard) {
      deps.error(deps.chalk.yellow(`Hint: Ensure clipboard access is allowed and it contains text.`));
    }
    
    process.exit(ExitCodes.ERROR); // Force exit with correct code
  }
};


// --- Analysis Function ---
const analyzeMarkdownContent = (
    markdownContent: FileContent
): AnalysisResult => {
    const lines = markdownContent.split(/\r?\n/);
    const issues: AnalysisIssue[] = [];
    const validBlocks: CodeBlock[] = [];

    // Find all delimiter lines
    const delimiterLines: DelimiterLine[] = lines.reduce(
        (acc: DelimiterLine[], lineContent, index) => {
            if (ANY_CODE_BLOCK_DELIMITER_REGEX.test(lineContent.trimStart())) {
                acc.push({ lineNumber: index + 1, content: lineContent });
            }
            return acc;
        },
        []
    );

    // Check for odd number of delimiters - this is an issue
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

    // Process matched delimiter pairs
    for (let i = 0; i < delimiterLines.length - 1; i += 2) {
        const startLine = delimiterLines[i];
        const endLine = delimiterLines[i + 1];

        if (!startLine || !endLine) continue;

        const trimmedStartLineContent = startLine.content.trim();
        const match = trimmedStartLineContent.match(CODE_BLOCK_START_LINE_REGEX);

        if (!match?.groups?.['path']) {
            issues.push({
                lineNumber: startLine.lineNumber,
                lineContent: startLine.content,
                message: "Invalid code block start tag format. Expected: ```[lang] // path/to/file.ext`",
            });
            continue;
        }

        // Extract code content - starting from the line after the delimiter
        // and stopping before the closing delimiter
        const codeContent = lines
            .slice(startLine.lineNumber, endLine.lineNumber - 1)
            .join('\n');

        validBlocks.push({
            filePath: match.groups['path'].trim(),
            fileContent: codeContent,
            startLineNumber: startLine.lineNumber,
        });
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

  const endTime = deps.hrtime(startTime);
  const durationMs = nanosecondsToMilliseconds(endTime);

  const successfulWrites = writeResults.filter(result => result.success).length;
  const failedWrites = writeResults.length - successfulWrites;

  return {
    writeResults: Object.freeze(writeResults),
    stats: {
      totalAttempted: writeResults.length,
      successfulWrites,
      failedWrites,
      durationMs
    }
  };
};

// --- Output Formatting ---
// formatAnalysisIssues and formatWriteResults remain the same structure
// Ensure deps signatures match full Dependencies if needed, or use Pick

const formatAnalysisIssues = (
    deps: Pick<Dependencies, "chalk">, // Pick only chalk
    issues: ReadonlyArray<AnalysisIssue>
): string[] => {
  return issues.map(
    (issue) =>
      `   ${deps.chalk.yellow(`[Line ${issue.lineNumber}]`)}: ${issue.message}\n   ${deps.chalk.dim(issue.lineContent)}`
  );
};

const formatWriteResults = (
  deps: Pick<Dependencies, "chalk">, // Pick only chalk
  { writeResults, stats }: ApplyResult
): string => {
  const resultLines: string[] = [];

  // Individual write results
  writeResults.forEach((result) => {
    const prefix = result.success
      ? deps.chalk.green("✔ Written: ")
      : deps.chalk.red("✗ Failed: ");
    let line = `${prefix}${result.filePath}`;
    if (!result.success && result.error) {
      line += ` (${deps.chalk.red(getErrorMessage(result.error))})`;
    }
    resultLines.push(line);
  });

  // Summary stats
  const duration = stats.durationMs.toFixed(2);
  resultLines.push(
    `\n${deps.chalk.bold("Summary:")}`,
    `Attempted: ${stats.totalAttempted} file(s) (${deps.chalk.green(
      `${stats.successfulWrites} succeeded`
    )}, ${deps.chalk.red(`${stats.failedWrites} failed`)})`
  );

  if (stats.durationMs > 0) {
    resultLines.push(`Completed in ${duration}ms`);
  }

  return resultLines.join("\n");
};

// --- Main Application Logic ---

const runApply = async (
  deps: Dependencies, // Use full Dependencies here
  argv: ReadonlyArray<string>
): Promise<void> => {
  try {
    // Parse arguments first
    const args = parseCliArguments(deps, argv);

    // Get input content
    const content = await getInputContent(deps, args, DEFAULT_ENCODING);

    // Analyze content - keep the same structure
    deps.error(deps.chalk.blue("Analyzing markdown content..."));
    const { validBlocks, issues } = analyzeMarkdownContent(content);

    // Process analysis results
    if (issues.length > 0) {
      deps.error(deps.chalk.yellow("\nAnalysis Issues Found:"));
      const formattedIssues = formatAnalysisIssues(deps, issues);
      formattedIssues.forEach(issue => deps.error(issue));

      if (validBlocks.length === 0) {
        deps.error(deps.chalk.red("\nNo valid code blocks were extracted due to analysis issues."));
        deps.error(deps.chalk.red(`Finished with ${issues.length} analysis issue(s).`));
        process.exit(ExitCodes.ERROR);
      }

      deps.error(deps.chalk.yellow("\nAttempting to process any valid blocks found..."));
    } else {
      deps.error(deps.chalk.green("Analysis complete. No issues found."));
    }

    // Process blocks
    if (validBlocks.length === 0) {
      deps.error(deps.chalk.blue("No valid code blocks found to apply."));
      if (issues.length > 0) {
        deps.error(deps.chalk.red(`Finished with ${issues.length} analysis issue(s).`));
        process.exit(ExitCodes.ERROR);
      }
      deps.error(deps.chalk.green("Finished successfully."));
      process.exit(ExitCodes.SUCCESS);
    }

    deps.error(
      deps.chalk.blue(`Applying changes for ${validBlocks.length} valid code block(s)...`)
    );

    // Apply the changes
    const writeResults = await writeFiles(deps, validBlocks, DEFAULT_ENCODING);

    // Log results
    const formattedResults = formatWriteResults(deps, writeResults);
    deps.log(formattedResults); // Use log, since this is user-facing output

    // Determine exit code
    if (issues.length > 0) {
      deps.error(deps.chalk.red(`Finished with ${issues.length} analysis issue(s).`));
      process.exit(ExitCodes.ERROR);
    }

    if (writeResults.stats.failedWrites > 0) {
      deps.error(deps.chalk.red("Finished with write errors."));
      process.exit(ExitCodes.ERROR);
    }

    deps.error(deps.chalk.green("Finished successfully."));
    process.exit(ExitCodes.SUCCESS);
  } catch (err: unknown) {
    deps.error(deps.chalk.red(`Unexpected error: ${getErrorMessage(err)}`));
    process.exit(ExitCodes.ERROR);
  }
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
  // Default dependency implementation using native bun functions
  const deps = await createDefaultDependencies();
  try {
    await runApply(deps, Bun.argv);
  } catch (error: unknown) {
    deps.error(deps.chalk.red(`Unhandled error: ${getErrorMessage(error)}`));
    deps.exit(ExitCodes.ERROR);
  }
};

// Use as direct invocation
if (import.meta.path === Bun.main) {
  await main();
  // Explicitly exit in case any promises are still pending
  process.exit(0);
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