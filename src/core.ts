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