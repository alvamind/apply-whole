// src/types.ts
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
  };
}

export interface ParsedArgsResult {
  readonly inputFile: FilePath | null;
  readonly useClipboard: boolean;
  readonly showHelp: boolean;
}

export interface LineChanges {
    readonly linesAdded: number;
    readonly linesDeleted: number;
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
  readonly totalLinesAdded: number; // Aggregate of linesAdded
  readonly totalLinesDeleted: number; // Aggregate of linesDeleted
}

export interface ApplyResult {
  readonly writeResults: ReadonlyArray<WriteResult>;
  readonly stats: ProcessingStats;
}

export interface Dependencies {
  readonly readFile: (filePath: FilePath, encoding: Encoding) => Promise<FileContent>;
  readonly writeFile: (filePath: FilePath, content: FileContent, encoding: Encoding) => Promise<void>;
  readonly exists: (path: FilePath) => Promise<boolean>;
  readonly mkdir: (path: FilePath, options: { readonly recursive: boolean }) => Promise<void>;
  readonly dirname: (path: FilePath) => FilePath;
  readonly readClipboard: () => Promise<FileContent>;
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
  readonly exit: (code: number) => never;
  readonly chalk: ChalkInstance;
  readonly parseArgs: <T extends ParseArgsConfig>(config: T) => ParsedArgsValues;
  readonly hrtime: (time?: Nanoseconds) => Nanoseconds;
}