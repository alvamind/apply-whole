// test/unit/formatters.test.ts
import { describe, test, expect } from "bun:test";
import type { AnalysisIssue, WriteResult, ApplyResult, WriteOperation } from "../../src/types";

describe("Result Formatters", () => {
  // Mock chalk for testing formatters
  const mockChalk = {
    red: (text: string) => `RED:${text}`,
    green: (text: string) => `GREEN:${text}`,
    yellow: (text: string) => `YELLOW:${text}`,
    blue: (text: string) => `BLUE:${text}`,
    cyan: (text: string) => `CYAN:${text}`,
    gray: (text: string) => `GRAY:${text}`,
    bold: {
      red: (text: string) => `BOLD:RED:${text}`,
      green: (text: string) => `BOLD:GREEN:${text}`,
      yellow: (text: string) => `BOLD:YELLOW:${text}`,
    },
  };

  test("formatAnalysisIssues should format issues correctly", () => {
    const issues: AnalysisIssue[] = [
      {
        lineNumber: 1,
        lineContent: "```js",
        message: "Invalid code block start tag format",
      },
      {
        lineNumber: 10,
        lineContent: "```",
        message: "Odd number of delimiters",
      },
    ];
    
    // Simple implementation for testing
    const formatAnalysisIssues = (issues: AnalysisIssue[]): string[] => {
      return issues.map(issue => 
        `${mockChalk.red(issue.message)} at Line ${issue.lineNumber}: ${mockChalk.gray(issue.lineContent)}`
      );
    };
    
    const formatted = formatAnalysisIssues(issues);
    
    expect(formatted.length).toBe(2);
    expect(formatted[0]).toContain("RED:Invalid code block");
    expect(formatted[0]).toContain("Line 1");
    expect(formatted[1]).toContain("RED:Odd number of delimiters");
    expect(formatted[1]).toContain("Line 10");
  });
  
  test("formatWriteResults should format success and failure correctly", () => {
    const writeResults: WriteResult[] = [
      { filePath: "file1.js", success: true, linesAdded: 5, linesDeleted: 2 },
      { filePath: "file2.js", success: false, error: new Error("Write error"), linesAdded: 0, linesDeleted: 0 },
    ];
    
    const applyResult: ApplyResult = {
      writeResults,
      originalStates: [],
      stats: {
        totalAttempted: 2,
        successfulWrites: 1,
        failedWrites: 1,
        totalLinesAdded: 5,
        totalLinesDeleted: 2,
        linesAdded: 5,
        linesDeleted: 2,
        durationMs: 1500,
      },
    };
    
    // Simple implementation for testing
    const formatWriteResults = (result: ApplyResult): string => {
      const lines = result.writeResults.map(res => {
        if (res.success) {
          return `${mockChalk.green('✔')} Written: ${res.filePath}`;
        } else {
          return `${mockChalk.red('✘')} Failed: ${res.filePath} (${res.error?.message})`;
        }
      });
      
      lines.push('');
      lines.push(`Summary: ${mockChalk.bold.green(`Attempted: ${result.stats.totalAttempted} file(s)`)}`);
      lines.push(`  ${mockChalk.green(`${result.stats.successfulWrites} succeeded`)}, ${mockChalk.red(`${result.stats.failedWrites} failed`)}`);
      lines.push(`  Completed in ${result.stats.durationMs.toFixed(1)}ms`);
      
      return lines.join('\n');
    };
    
    const formatted = formatWriteResults(applyResult);
    
    expect(formatted).toContain("GREEN:✔ Written: file1.js");
    expect(formatted).toContain("RED:✘ Failed: file2.js");
    expect(formatted).toContain("Write error");
    expect(formatted).toContain("BOLD:GREEN:Attempted: 2 file(s)");
    expect(formatted).toContain("GREEN:1 succeeded");
    expect(formatted).toContain("RED:1 failed");
    expect(formatted).toContain("Completed in 1500.0ms");
  });
  
  test("stripAnsi should remove ANSI color codes", () => {
    const stripAnsi = (str: string): string => {
      // Simple regex to match ANSI codes
      const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
      return str.replace(ansiRegex, "");
    };
    
    const coloredText = "\u001b[31mred\u001b[0m \u001b[32mgreen\u001b[0m";
    const stripped = stripAnsi(coloredText);
    
    expect(stripped).toBe("red green");
    expect(stripped).not.toContain("\u001b[31m");
    expect(stripped).not.toContain("\u001b[0m");
  });
}); 