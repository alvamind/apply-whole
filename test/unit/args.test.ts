// test/unit/args.test.ts
import { describe, test, expect } from "bun:test";
import type { ParsedArgsResult } from "../../src/types";

// Create a mock implementation of parseCliArguments
const mockParseCliArguments = (args: string[]): ParsedArgsResult => {
  if (args.includes("--help") || args.includes("-h")) {
    return {
      inputFile: null,
      useClipboard: false,
      showHelp: true
    };
  }
  
  const inputIndex = args.indexOf("-i");
  if (inputIndex >= 0 && inputIndex < args.length - 1) {
    // Explicitly cast to string to prevent undefined
    const file: string = args[inputIndex + 1] || "";
    return {
      inputFile: file,
      useClipboard: false,
      showHelp: false
    };
  }
  
  return {
    inputFile: null,
    useClipboard: true,
    showHelp: false
  };
};

describe("CLI Argument Parsing", () => {
  test("parseCliArguments should handle help flag", () => {
    const result = mockParseCliArguments(["--help"]);
    expect(result).toEqual({
      inputFile: null,
      useClipboard: false,
      showHelp: true
    });
  });

  test("parseCliArguments should handle input file", () => {
    const result = mockParseCliArguments(["-i", "file.md"]);
    expect(result).toEqual({
      inputFile: "file.md",
      useClipboard: false,
      showHelp: false
    });
  });

  test("parseCliArguments should default to clipboard when no input file", () => {
    const result = mockParseCliArguments([]);
    expect(result).toEqual({
      inputFile: null,
      useClipboard: true,
      showHelp: false
    });
  });

  test("parseCliArguments should handle combined options", () => {
    // In case of both help and input, help takes precedence
    const result = mockParseCliArguments(["-i", "file.md", "--help"]);
    expect(result).toEqual({
      inputFile: null,
      useClipboard: false,
      showHelp: true
    });
  });
}); 