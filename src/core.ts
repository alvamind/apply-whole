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
} from "./types";
import chalk from "chalk";
import clipboardy from "clipboardy";

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
    let inCodeBlock = false;
    let currentBlockStart = 0;
    let currentBlockPath = "";
    let contentStart = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] || ""; // Handle potentially undefined lines
        const trimmedLine = line.trimStart();

        // Check if this line starts or ends a code block
        if (ANY_CODE_BLOCK_DELIMITER_REGEX.test(trimmedLine)) {
            if (!inCodeBlock) {
                // Start of a code block
                inCodeBlock = true;
                currentBlockStart = i;
                
                // Check if path is on the same line as the opening delimiter
                const match = trimmedLine.match(CODE_BLOCK_START_LINE_REGEX);
                if (match?.groups?.['path']) {
                    currentBlockPath = match.groups['path'].trim();
                    contentStart = i + 1; // Content starts on the next line
                } else if (i + 1 < lines.length) {
                    // Check if path is on the next line
                    const nextLine = lines[i + 1] || "";
                    const pathMatch = nextLine.match(PATH_ON_NEXT_LINE_REGEX);
                    if (pathMatch?.groups?.['path']) {
                        currentBlockPath = pathMatch.groups['path'].trim();
                        contentStart = i + 2; // Content starts two lines after
                    } else {
                        // No path found
                        currentBlockPath = "";
                    }
                } else {
                    // Last line of the file can't have a path on next line
                    currentBlockPath = "";
                }
            } else {
                // End of a code block
                inCodeBlock = false;
                
                if (currentBlockPath) {
                    // We have a valid path, extract content
                    const contentEnd = i;
                    const blockContent = lines.slice(contentStart, contentEnd).join('\n');
                    
                    validBlocks.push({
                        filePath: currentBlockPath,
                        fileContent: blockContent,
                        startLineNumber: currentBlockStart + 1 // Convert to 1-indexed
                    });
                } else {
                    // No valid path was found
                    issues.push({
                        lineNumber: currentBlockStart + 1, // Convert to 1-indexed
                        lineContent: lines[currentBlockStart] || "",
                        message: "Invalid code block start tag format. Expected: ```[lang] // path/to/file.ext`",
                    });
                }
                
                // Reset state
                currentBlockPath = "";
            }
        }
    }
    
    // Check if there's an unclosed code block
    if (inCodeBlock) {
        issues.push({
            lineNumber: currentBlockStart + 1, // Convert to 1-indexed
            lineContent: lines[currentBlockStart] || "",
            message: "Found an odd number of '```' delimiters. Blocks may be incomplete or incorrectly matched.",
        });
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

    // Simple line count difference for basic stats
    const linesAdded = Math.max(0, newLines.length - oldLines.length);
    const linesDeleted = Math.max(0, oldLines.length - newLines.length);

    // Note: This is a basic count diff, not a true diff algorithm.
    // For more accurate add/delete based on content matching, a diff library would be needed.
    // However, sticking to core implementation per requirements.
    return { linesAdded, linesDeleted };
};

const performWrite = async (
  deps: Pick<Dependencies, "writeFile" | "readFile" | "exists" | "mkdir" | "dirname">,
  block: CodeBlock,
  encoding: Encoding
): Promise<WriteResult> => {
  let oldContent: FileContent | null = null;
  let lineChanges: LineChanges = { linesAdded: 0, linesDeleted: 0 };
  try {
    await ensureDirectoryExists(deps, block.filePath);

    try {
      oldContent = await deps.readFile(block.filePath, encoding);
    } catch (readError: unknown) {
      // Ignore ENOENT (file not found), treat as empty old content
      if (!(readError instanceof Error && 'code' in readError && readError.code === 'ENOENT')) {
        throw readError; // Re-throw other read errors
      }
    }

    await deps.writeFile(block.filePath, block.fileContent, encoding);
    lineChanges = calculateLineChanges(oldContent, block.fileContent);

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
  deps: Pick<Dependencies, "writeFile" | "readFile" | "exists" | "mkdir" | "dirname" | "hrtime">,
  blocks: ReadonlyArray<CodeBlock>,
  encoding: Encoding
): Promise<ApplyResult> => {
  const startTime = deps.hrtime();
  
  // Track the original state of each file before modifications
  const originalStates = await Promise.all(blocks.map(async (block) => {
    let originalContent: FileContent | null = null;
    const fileExists = await deps.exists(block.filePath);
    
    if (fileExists) {
      try {
        originalContent = await deps.readFile(block.filePath, encoding);
      } catch (error) {
        // If error reading file, treat as if it doesn't exist
        originalContent = null;
      }
    }
    
    return {
      block,
      originalContent,
      originallyExisted: fileExists
    };
  }));

  const writePromises = blocks.map(block => performWrite(deps, block, encoding));
  const writeResults = await Promise.all(writePromises);

  const endTime = deps.hrtime(startTime);
  const durationMs = nanosecondsToMilliseconds(endTime);

  const initialStats: ProcessingStats = {
      totalAttempted: blocks.length,
      successfulWrites: 0,
      failedWrites: 0,
      totalLinesAdded: 0,
      totalLinesDeleted: 0,
      linesAdded: 0,
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
    originalStates: Object.freeze(originalStates),
    stats: finalStats
  };
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
  ].filter(Boolean); // Remove empty strings

  return [...resultLines, ...summary].join("\n");
};

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
          // File existed but couldn't be read, or was empty. 
          // For safety, delete the file since we can't restore its content
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
      finalExitCode = ExitCodes.ERROR; // Mark potential failure even if some blocks are valid
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

        if (applyResult.stats.failedWrites > 0) {
            finalExitCode = ExitCodes.ERROR; // Mark failure if any write failed
        }
        
        // Proceed to confirmation only if there were successful writes
        const successfulWrites = applyResult.writeResults.filter(r => r.success);
        if (successfulWrites.length > 0) {
            // Check for auto-apply environment variable or stdin input
            const isTestEnvironment = process.env['BUN_APPLY_AUTO_YES'] === 'true';
            
            // Skip prompting in test environment
            let shouldKeepChanges = true;
            if (!isTestEnvironment) {
                const response = await deps.prompt(deps.chalk.yellow(CONFIRMATION_PROMPT));
                const confirmation = response.toLowerCase().trim();
                shouldKeepChanges = confirmation === 'y' || confirmation === 'yes';
            }
            
            if (shouldKeepChanges) {
                deps.log(deps.chalk.green(CHANGES_APPLIED_MESSAGE));
                // Keep finalExitCode as previously determined
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
                    // Even if analysis had issues, user revert means operation completed as requested
                    // Override previous error status if revert was clean
                    finalExitCode = ExitCodes.SUCCESS;
                } else {
                    deps.error(deps.chalk.red("Errors occurred during revert operation. Filesystem may be in an inconsistent state."));
                    finalExitCode = ExitCodes.ERROR; // Revert failed, definitely an error state
                }
            }
        }
    }

    if (finalExitCode === ExitCodes.ERROR) {
      deps.error(deps.chalk.red(`Finished with issues.`));
    } else {
      deps.error(deps.chalk.green("Finished successfully."));
    }
    deps.exit(finalExitCode);

  } catch (err: unknown) {
    // This catch block handles unexpected errors not caught elsewhere
    // reportErrorAndExit is preferred for controlled exits
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
      const onData = (data: Buffer) => {
        resolve(data.toString().trim());
      };
      
      process.stdin.once('data', onData);
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