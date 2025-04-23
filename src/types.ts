// src/types.ts

import type { ChalkInstance } from "chalk";
// Remove ParsedResults import
import type { ParseArgsConfig } from "node:util"; // Keep ParseArgsConfig

// --- Primitive Aliases ---
export type FilePath = string;
export type FileContent = string;
export type ErrorMessage = string;
export type Milliseconds = number;
export type Nanoseconds = [number, number]; // From process.hrtime
export type ExitCode = number;
export type Encoding = "utf-8"; // Or other encodings if needed
export type LineNumber = number;

// --- Core Data Structures ---
export interface CodeBlock {
  readonly filePath: FilePath;
  readonly fileContent: FileContent;
  readonly startLineNumber: LineNumber;
}

// --- Analysis Types ---
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

// --- Command Line Arguments ---

// Define the expected structure returned by parseArgs based on ARGS_CONFIG
export interface ParsedArgsValues {
  readonly values: {
    readonly input?: string;
    readonly help?: boolean;
    // Add other potential options here if ARGS_CONFIG changes
  };
  // Include other properties like 'positionals' if needed, though we avoid them
  // readonly positionals: readonly string[];
}

export interface ParsedArgsResult {
  readonly inputFile: FilePath | null;
  readonly useClipboard: boolean;
  readonly showHelp: boolean;
}

// --- I/O Results ---
export interface WriteResult {
  readonly filePath: FilePath;
  readonly success: boolean;
  readonly error?: Error;
}

// --- Execution Summary ---
export interface ProcessingStats {
  readonly totalAttempted: number;
  readonly successfulWrites: number;
  readonly failedWrites: number;
  readonly durationMs: Milliseconds;
}

export interface ApplyResult {
  readonly writeResults: ReadonlyArray<WriteResult>;
  readonly stats: ProcessingStats;
}

// --- Dependency Injection Interface ---
export interface Dependencies {
  // Filesystem & I/O
  readonly readFile: (filePath: FilePath, encoding: Encoding) => Promise<FileContent>;
  readonly writeFile: (filePath: FilePath, content: FileContent, encoding: Encoding) => Promise<void>;
  readonly exists: (path: FilePath) => Promise<boolean>;
  readonly mkdir: (path: FilePath, options: { readonly recursive: boolean }) => Promise<void>;
  readonly dirname: (path: FilePath) => FilePath;
  readonly readClipboard: () => Promise<FileContent>;

  // Console & Process
  readonly log: (message: string) => void;
  readonly error: (message: string) => void;
  readonly exit: (code: number) => never; // Use number type directly for exit code

  // Utilities
  readonly chalk: ChalkInstance;
  // Use the specific type we defined
  readonly parseArgs: <T extends ParseArgsConfig>(config: T) => ParsedArgsValues;
  readonly hrtime: (time?: Nanoseconds) => Nanoseconds;
}