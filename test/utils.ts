// test/utils.ts
import { rm, mkdtemp, writeFile as nodeWriteFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FilePath, FileContent } from "../src/types";

export interface TestEnvironment {
  readonly tempDir: FilePath;
  readonly cleanup: () => Promise<void>;
  readonly createInputFile: (content: FileContent) => Promise<FilePath>;
  readonly runCommand: (
    args: ReadonlyArray<string>,
    stdin?: string
  ) => Promise<{
    readonly stdout: string;
    readonly stderr: string;
    readonly exitCode: number | null;
  }>;
  readonly readFileContent: (relativePath: FilePath) => Promise<FileContent>;
  readonly fileExists: (relativePath: FilePath) => Promise<boolean>;
}

export const setupTestEnvironment = async (): Promise<TestEnvironment> => {
  const tempDirPrefix = join(tmpdir(), "bun-apply-test-");
  const tempDir = await mkdtemp(tempDirPrefix);

  const cleanup = async (): Promise<void> => {
    await rm(tempDir, { recursive: true, force: true });
  };

  const createInputFile = async (content: FileContent): Promise<FilePath> => {
    const inputFilePath = join(tempDir, "input.md");
    await nodeWriteFile(inputFilePath, content, "utf-8");
    return inputFilePath;
  };

  const runCommand = async (
    args: ReadonlyArray<string>,
    stdin?: string
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
  }> => {
    // Set up environment variables for testing
    // We auto-confirm changes by default, but if stdin is provided (for reversion tests),
    // we don't auto-confirm so the provided stdin can be used
    const env = { 
      ...Bun.env, 
      NO_COLOR: "1",
      BUN_APPLY_AUTO_YES: stdin ? "false" : "true" 
    };
    
    const spawnedProcess = Bun.spawnSync(
      ["bun", "run", join(import.meta.dir, "..", "src", "core.ts"), ...args],
      {
        cwd: tempDir,
        stdin: stdin ? new TextEncoder().encode(stdin) : undefined,
        stdout: "pipe",
        stderr: "pipe",
        env,
      }
    );

    const stdout = await new Response(spawnedProcess.stdout).text();
    const stderr = await new Response(spawnedProcess.stderr).text();

    // Ensure exitCode is treated as nullable number
    const exitCode = typeof spawnedProcess.exitCode === 'number' ? spawnedProcess.exitCode : null;

    return { stdout, stderr, exitCode };
  };

    const readFileContent = async (relativePath: FilePath): Promise<FileContent> => {
        const fullPath = join(tempDir, relativePath);
        const file = Bun.file(fullPath);
        return await file.text();
    };

    const fileExists = async (relativePath: FilePath): Promise<boolean> => {
        const fullPath = join(tempDir, relativePath);
        try {
            await stat(fullPath);
            return true;
        } catch (error) {
            return false;
        }
    };

  return Object.freeze({
    tempDir,
    cleanup,
    createInputFile,
    runCommand,
    readFileContent,
    fileExists
  });
};

// Helper to strip ANSI codes for less brittle assertions if needed
export const stripAnsi = (str: string): string => {
  // Regular expression to match ANSI escape codes
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return str.replace(ansiRegex, "");
};