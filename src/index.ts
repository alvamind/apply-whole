// Export public types and functions
import type {
  CodeBlock,
  AnalysisResult,
  AnalysisIssue,
  WriteResult,
  ApplyResult,
  ProcessingStats,
  LineChanges,
} from "./types";

import { analyzeMarkdownContent, createDefaultDependencies, runApply } from "./core";

// Re-export types
export type {
  CodeBlock,
  AnalysisResult,
  AnalysisIssue,
  WriteResult,
  ApplyResult,
  ProcessingStats,
  LineChanges,
};

// Public API
export { analyzeMarkdownContent, createDefaultDependencies, runApply };

// Default export for convenience
export default {
  analyzeMarkdownContent,
  createDefaultDependencies,
  runApply,
}; 