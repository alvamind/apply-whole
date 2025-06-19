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
  READING_FILE_START,
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
      try {
        deps.error(deps.chalk.blue(READING_FILE_START(args.inputFile)));
        const content = await deps.readFile(args.inputFile, encoding);
        return content;
      } catch (err: unknown) {
        return reportErrorAndExit(
          deps,
          `Failed to read from file: ${args.inputFile}: ${getErrorMessage(err)}\nHint: Ensure the file '${args.inputFile}' exists.`,
          ExitCodes.ERROR
        );
      }
    } else if (args.useClipboard) {
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
  const resultLines: string[] = writeResults.map((result) => {
    const statusIcon = result.success ? deps.chalk.green("✔") : deps.chalk.red("✗");
    
    // Determine the action type based on originalState
    let action = "Failed";
    if (result.success) {
      action = "Written"; // Changed from Created/Replaced to Written to match tests
    }
    
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

  // Keep track of parent directories of newly created files for cleanup.
  const parentDirsOfNewFiles: Set<string> = new Set();

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
          // File existed and we have its content, so restore it.
          await deps.writeFile(result.filePath, originalState.originalContent, encoding);
          deps.log(REVERT_ACTION_MESSAGE(result.filePath, "restored"));
        } else {
          // File existed, but we failed to read its original content.
          // The file has been overwritten. Deleting it would be data loss.
          // Warn the user that we cannot revert this specific file to its original state.
          deps.error(deps.chalk.yellow(`   Warning: Cannot revert ${result.filePath} to its original state as it could not be read. The file has been modified.`));
          allRevertedSuccessfully = false; // The revert is not fully successful.
        }
      } else {
        // File was newly created by this tool, so we can safely delete it.
        await deps.unlink(result.filePath);
        deps.log(REVERT_ACTION_MESSAGE(result.filePath, "deleted"));

        // Remember its parent directory for potential cleanup.
        const dir = deps.dirname(result.filePath);
        if (dir && dir !== '.' && dir !== '/') {
          parentDirsOfNewFiles.add(dir);
          
          // Also add all parent directories to the cleanup list
          let currentDir = dir;
          while (currentDir && currentDir !== '.' && currentDir !== '/') {
            currentDir = deps.dirname(currentDir);
            if (currentDir && currentDir !== '.' && currentDir !== '/') {
              parentDirsOfNewFiles.add(currentDir);
            }
          }
        }
      }
    } catch (revertError: unknown) {
      deps.error(deps.chalk.red(REVERT_ERROR_MESSAGE(result.filePath, getErrorMessage(revertError))));
      allRevertedSuccessfully = false;
    }
  }

  // Try to clean up directories that may now be empty.
  if (parentDirsOfNewFiles.size > 0) {
    // Convert to array and sort by depth (descending) to remove nested dirs first.
    const directories = Array.from(parentDirsOfNewFiles)
      .sort((a, b) => b.split('/').length - a.split('/').length);

    for (const dir of directories) {
      try {
        // Check if directory exists first
        const dirExists = await deps.exists(dir);
        if (!dirExists) {
          // Directory already gone, nothing to do
          continue;
        }

        // Check if directory is truly empty before attempting to remove it
        const dirContents = await deps.readdir(dir);
        
        // If directory is not empty, leave it alone
        if (dirContents && dirContents.length > 0) {
          continue;
        }
        
        // Only remove if directory is empty
        await deps.rmdir(dir);
        deps.log(REVERT_ACTION_MESSAGE(dir, "directory removed"));
      } catch (error: unknown) {
        // Skip any errors related to directory operations
        const errorMessage = getErrorMessage(error);
        if (!errorMessage.includes('ENOENT')) { // Only log if it's not a "not found" error
          deps.error(deps.chalk.yellow(`   Note: Could not clean up directory ${dir}. Error: ${errorMessage}`));
        }
      }
    }
  }

  deps.error(deps.chalk.yellow(REVERTING_DONE)); // Status message
  return allRevertedSuccessfully;
};

const confirmAndPotentiallyRevert = async (
    deps: Dependencies,
    applyResult: ApplyResult,
    encoding: Encoding,
    skipLinter: boolean, // Pass skipLinter flag
    initialLintResult: LinterResult | null // Add initialLintResult parameter
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
            
            // Compare with initialLintResult if we have both results
            if (initialLintResult && finalLintResult) {
                const errorChange = finalLintResult.errors - initialLintResult.errors;
                const warningChange = finalLintResult.warnings - initialLintResult.warnings;
                
                // Only show changes if there are any
                if (errorChange !== 0 || warningChange !== 0) {
                    const errorColor = errorChange > 0 ? deps.chalk.red : deps.chalk.green;
                    const warningColor = warningChange > 0 ? deps.chalk.yellow : deps.chalk.green;
                    
                    deps.error(deps.chalk.blue(`${LINTER_CHANGE_MSG(
                        errorChange,
                        warningChange,
                        errorColor,
                        warningColor
                    )}`));
                }
            }
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
      // Only set exit code to ERROR if we don't have valid blocks
      if (validBlocks.length === 0) {
         deps.error(deps.chalk.red("\nNo valid code blocks extracted due to analysis issues. Aborting operation."));
         // No changes applied, exit early with error
         return deps.exit(ExitCodes.ERROR);
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
        // Pass skipLinter flag and initialLintResult down
        const confirmResult = await confirmAndPotentiallyRevert(deps, applyResult, DEFAULT_ENCODING, args.skipLinter, initialLintResult);
        changesAppliedOrReverted = true; // An action was taken or reverted

        // Update finalExitCode based on confirmation/revert result
        finalExitCode = confirmResult.finalExitCode;
    }

    // --- Final Status Message ---
    // We don't report the final linter results here anymore as they are shown before the prompt
    // If no action was taken (no valid blocks or analysis failure with no blocks), we just report the initial state.
    if (finalExitCode === ExitCodes.ERROR) {
      deps.error(deps.chalk.red(`Finished with issues.`));
    } else if (analysisHadIssues) {
      // If we had analysis issues but all operations succeeded, report mixed status
      deps.error(deps.chalk.yellow("Finished with some analysis issues, but all operations completed."));
    } else if (!changesAppliedOrReverted && !analysisHadIssues) {
      deps.error(deps.chalk.blue("Finished. No changes were applied or needed."));
    } else {
      // Success includes successful apply or successful revert
      deps.error(deps.chalk.green("Finished successfully."));
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
  const { dirname: nodeDirname, parseArgs: nodeParseArgs, unlink: nodeUnlink, rmdir: nodeRmdir, readdir: nodeReaddir } = await import("node:path").then(
    async () => ({
      dirname: (await import("node:path")).dirname,
      parseArgs: (await import("node:util")).parseArgs,
      unlink: (await import("node:fs/promises")).unlink,
      rmdir: (await import("node:fs/promises")).rmdir,
      readdir: (await import("node:fs/promises")).readdir,
    })
  );

  const readFile = (filePath: FilePath, _encoding: Encoding): Promise<FileContent> =>
    Bun.file(filePath).text();

  const writeFile = (filePath: FilePath, content: FileContent, _encoding: Encoding): Promise<void> =>
    Bun.write(filePath, content).then(() => {});

  const exists = async (path: FilePath): Promise<boolean> => {
    try {
      const { stat } = await import('node:fs/promises');
      await stat(path);
      return true;
    } catch (e) {
      // If it doesn't exist (ENOENT error), return false
      // Otherwise, propagate the error
      const errorMessage = getErrorMessage(e);
      if (errorMessage.includes('ENOENT')) {
        return false;
      }
      throw e;
    }
  };

  const mkdir = async (path: FilePath, options: { readonly recursive: boolean }): Promise<void> => {
    if (options.recursive) {
      await Bun.write(path + '/.keep', '');
      await nodeUnlink(path + '/.keep');
    } else {
      // For non-recursive, use fs.promises mkdir
      const { mkdir: nodeMkdir } = await import("node:fs/promises");
      await nodeMkdir(path);
    }
  };

  const readClipboard = async (): Promise<FileContent> => {
    try {
      return await clipboardy.read();
    } catch (error) {
      throw new Error(`Clipboard access failed: ${getErrorMessage(error)}`);
    }
  };

  const prompt = async (message: string): Promise<string> => {
    if (!process.stdin.isTTY) {
      // Fallback for non-TTY environments (like tests)
      console.error("Warning: Running in a non-TTY environment, prompts may not work properly");
      // Mock a "y" response in test environments for automated testing
      if (process.env['BUN_APPLY_AUTO_YES'] === 'true') {
        return "y";
      }
      return "";
    }
    process.stdout.write(message);
    return new Promise((resolve) => {
      const onData = (data: Buffer) => {
        const input = data.toString().trim();
        process.stdin.removeListener("data", onData);
        process.stdin.pause();
        resolve(input);
      };
      process.stdin.resume();
      process.stdin.once("data", onData);
    });
  };

  const unlink = async (path: FilePath): Promise<void> => {
    await nodeUnlink(path);
  };
  
  const rmdir = async (path: FilePath, options?: { readonly recursive?: boolean }): Promise<void> => {
    await nodeRmdir(path, options);
  };
  
  const readdir = async (path: FilePath): Promise<string[]> => {
    try {
      return await nodeReaddir(path);
    } catch (error) {
      // If directory not found, just return empty array
      if (getErrorMessage(error).includes('ENOENT')) {
        return [];
      }
      throw error;
    }
  };

  // Updated Linter implementation using Bun.spawn
  const runLinter = async (): Promise<LinterResult | null> => {
    try {
      const proc = Bun.spawn([...LINTER_COMMAND], { // Convert ReadonlyArray to regular array using spread operator
        stdout: "pipe",
        stderr: "pipe",
      });

      // Collect stdout and stderr data
      let stdoutData = "";
      let stderrData = "";
      
      // Read streams properly
      const stdoutReader = proc.stdout.getReader();
      const stderrReader = proc.stderr.getReader();
      
      // Read stdout
      try {
        while (true) {
          const { done, value } = await stdoutReader.read();
          if (done) break;
          stdoutData += new TextDecoder().decode(value);
        }
      } catch (error) {
        console.error(chalk.yellow(`Error reading stdout: ${getErrorMessage(error)}`));
      } finally {
        stdoutReader.releaseLock();
      }
      
      // Read stderr
      try {
        while (true) {
          const { done, value } = await stderrReader.read();
          if (done) break;
          stderrData += new TextDecoder().decode(value);
        }
      } catch (error) {
        console.error(chalk.yellow(`Error reading stderr: ${getErrorMessage(error)}`));
      } finally {
        stderrReader.releaseLock();
      }
      
      await proc.exited;

      const output = stdoutData + stderrData; // Combine both streams for full output analysis
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
    rmdir,
    readdir,
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