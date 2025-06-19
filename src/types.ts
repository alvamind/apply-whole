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
  readonly rmdir: (path: FilePath, options?: { readonly recursive: boolean }) => Promise<void>;
  readonly readdir: (path: FilePath) => Promise<string[]>;
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
export type RevertDeps = Pick<Dependencies, "writeFile" | "unlink" | "log" | "error" | "chalk" | "dirname" | "rmdir" | "readdir" | "exists"> & ErrorExitDeps; // Added exists
export type LintingDeps = Pick<Dependencies, "runLinter" | "error" | "chalk">;
export type RunApplyDeps = Dependencies & LintingDeps;
