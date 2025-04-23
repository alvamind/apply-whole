// test/unit/core.test.ts
import { describe, test, expect, mock } from "bun:test";
import chalk from "chalk";
import type { WriteResult, CodeBlock, Nanoseconds, WriteOperation, FilePath } from "../../src/types";
import {
  analyzeMarkdownContent,
  revertChanges,
  writeFiles,
} from "../../src/core";

describe("Core functions - analysis", () => {
  test("analyzeMarkdownContent should extract valid code blocks", () => {
    const markdown = `
# Test markdown

\`\`\`js // path/to/file.js
const x = 1;
\`\`\`
`;

    const result = analyzeMarkdownContent(markdown);
    
    expect(result.issues.length).toBe(0);
    expect(result.validBlocks.length).toBe(1);
    expect(result.validBlocks[0]?.filePath).toBe("path/to/file.js");
    expect(result.validBlocks[0]?.fileContent).toBe("const x = 1;");
  });

  test("analyzeMarkdownContent should identify issues with missing path", () => {
    const markdown = `
\`\`\`js
const x = 1;
\`\`\`
`;

    const result = analyzeMarkdownContent(markdown);
    
    expect(result.issues.length).toBe(1);
    expect(result.issues[0]?.message).toContain("Code block found, but missing file path comment");
    expect(result.validBlocks.length).toBe(0);
  });

  test("analyzeMarkdownContent should identify issues with unmatched delimiters", () => {
    const markdown = `
\`\`\`js // path/to/file.js
const x = 1;
`;

    const result = analyzeMarkdownContent(markdown);
    
    expect(result.issues.length).toBe(1);
    expect(result.issues[0]?.message).toContain("Unclosed code block detected");
    expect(result.validBlocks.length).toBe(0);
  });

  test("analyzeMarkdownContent should handle multiple blocks correctly", () => {
    const markdown = `
\`\`\`js // path/to/file1.js
const x = 1;
\`\`\`

Some text in between

\`\`\`js // path/to/file2.js
const y = 2;
\`\`\`
`;

    const result = analyzeMarkdownContent(markdown);
    
    expect(result.issues.length).toBe(0);
    expect(result.validBlocks.length).toBe(2);
    expect(result.validBlocks[0]?.filePath).toBe("path/to/file1.js");
    expect(result.validBlocks[1]?.filePath).toBe("path/to/file2.js");
  });

  test("analyzeMarkdownContent should handle mixed valid and invalid blocks", () => {
    const markdown = `
\`\`\`js // path/to/file1.js
const x = 1;
\`\`\`

\`\`\`js
const y = 2;
\`\`\`

\`\`\`js // path/to/file2.js
const z = 3;
\`\`\`
`;

    const result = analyzeMarkdownContent(markdown);
    
    expect(result.issues.length).toBe(1);
    expect(result.validBlocks.length).toBe(2);
    expect(result.validBlocks[0]?.filePath).toBe("path/to/file1.js");
    expect(result.validBlocks[1]?.filePath).toBe("path/to/file2.js");
  });

  // Tests for the path format detection feature
  test("should detect path on same line as backticks", () => {
    const markdown = `
\`\`\`js // path/to/file.js
const x = 1;
\`\`\`
`;

    const result = analyzeMarkdownContent(markdown);
    
    expect(result.issues.length).toBe(0);
    expect(result.validBlocks.length).toBe(1);
    expect(result.validBlocks[0]?.filePath).toBe("path/to/file.js");
    expect(result.validBlocks[0]?.fileContent).toBe("const x = 1;");
  });

  test("should detect path on separate line after backticks", () => {
    const markdown = `
\`\`\`js
// path/to/file.js
const x = 1;
\`\`\`
`;

    const result = analyzeMarkdownContent(markdown);
    
    expect(result.issues.length).toBe(0);
    expect(result.validBlocks.length).toBe(1);
    expect(result.validBlocks[0]?.filePath).toBe("path/to/file.js");
    expect(result.validBlocks[0]?.fileContent).toBe("const x = 1;");
  });

  test("should handle mix of path format styles in multiple blocks", () => {
    const markdown = `
\`\`\`js // path/to/file1.js
const x = 1;
\`\`\`

\`\`\`ts
// path/to/file2.ts
const y: number = 2;
\`\`\`
`;

    const result = analyzeMarkdownContent(markdown);
    
    expect(result.issues.length).toBe(0);
    expect(result.validBlocks.length).toBe(2);
    expect(result.validBlocks[0]?.filePath).toBe("path/to/file1.js");
    expect(result.validBlocks[1]?.filePath).toBe("path/to/file2.ts");
    expect(result.validBlocks[0]?.fileContent).toBe("const x = 1;");
    expect(result.validBlocks[1]?.fileContent).toBe("const y: number = 2;");
  });

  test("should extract content correctly when path is on separate line", () => {
    const markdown = `
\`\`\`typescript
// src/component.tsx
import React from 'react';

const Component = () => {
  return <div>Hello</div>;
};

export default Component;
\`\`\`
`;

    const result = analyzeMarkdownContent(markdown);
    
    expect(result.issues.length).toBe(0);
    expect(result.validBlocks.length).toBe(1);
    expect(result.validBlocks[0]?.filePath).toBe("src/component.tsx");
    expect(result.validBlocks[0]?.fileContent).toBe("import React from 'react';\n\nconst Component = () => {\n  return <div>Hello</div>;\n};\n\nexport default Component;");
  });

  test("should handle comment variations in path format", () => {
    const markdown = `
\`\`\`js //path/without/space.js
const noSpace = true;
\`\`\`

\`\`\`js
//path/without/space/on/next/line.js
const noSpaceNextLine = true;
\`\`\`

\`\`\`js // path/with/extra/spaces.js  
const extraSpaces = true;
\`\`\`

\`\`\`js
// path/with/extra/spaces/on/next/line.js  
const extraSpacesNextLine = true;
\`\`\`
`;

    const result = analyzeMarkdownContent(markdown);
    
    expect(result.issues.length).toBe(0);
    expect(result.validBlocks.length).toBe(4);
    expect(result.validBlocks[0]?.filePath).toBe("path/without/space.js");
    expect(result.validBlocks[1]?.filePath).toBe("path/without/space/on/next/line.js");
    expect(result.validBlocks[2]?.filePath).toBe("path/with/extra/spaces.js");
    expect(result.validBlocks[3]?.filePath).toBe("path/with/extra/spaces/on/next/line.js");
  });
});

describe("Core functions - reversion", () => {
  test("writeFiles should preserve original states for reversion", async () => {
    // Mock dependencies
    const mockDeps = {
      readFile: mock(async (filePath: FilePath) => {
        if (filePath === "existing-file.js") {
          return "// Original content";
        }
        throw new Error("ENOENT");
      }),
      writeFile: mock(async () => {}),
      exists: mock(async (filePath: FilePath) => filePath === "existing-file.js"),
      mkdir: mock(async () => {}),
      dirname: mock((path: FilePath) => {
        return path.split("/").slice(0, -1).join("/") || ".";
      }),
      hrtime: mock((): Nanoseconds => {
        return [1, 0]; // Always return 1 second
      }),
      error: mock(() => {}),
      chalk: { 
        blue: (text: string) => text,
        red: (text: string) => text,
        green: (text: string) => text,
        yellow: (text: string) => text,
      } as unknown as typeof chalk,
    };

    // Test data
    const blocks: CodeBlock[] = [
      {
        filePath: "existing-file.js",
        fileContent: "// Modified content",
        startLineNumber: 1,
      },
      {
        filePath: "new-file.js",
        fileContent: "// New content",
        startLineNumber: 5,
      },
    ];

    // Execute
    const result = await writeFiles(mockDeps, blocks, "utf-8");

    // Verify
    expect(result.originalStates.length).toBe(2);
    
    // Check first originalState (existing file)
    const firstState = result.originalStates[0];
    expect(firstState?.block.filePath).toBe("existing-file.js");
    expect(firstState?.originalContent).toBe("// Original content");
    expect(firstState?.originallyExisted).toBe(true);
    
    // Check second originalState (new file)
    const secondState = result.originalStates[1];
    expect(secondState?.block.filePath).toBe("new-file.js");
    expect(secondState?.originalContent).toBe(null);
    expect(secondState?.originallyExisted).toBe(false);
    
    // Verify the mocks were called correctly
    expect(mockDeps.exists).toHaveBeenCalledTimes(4);
    expect(mockDeps.readFile).toHaveBeenCalledWith("existing-file.js", "utf-8");
  });

  test("revertChanges functionality works correctly", async () => {
    // Create mock dependencies
    const mockDeps = {
      writeFile: mock(() => Promise.resolve()),
      unlink: mock(() => Promise.resolve()),
      log: mock(() => {}),
      error: mock(() => {}),
      chalk: { 
        green: (text: string) => text, 
        red: (text: string) => text,
        yellow: (text: string) => text,
        blue: (text: string) => text,
      } as unknown as typeof chalk,
      exit: mock((code: number) => { throw new Error(`Exit called with code ${code}`); }) as unknown as (code: number) => never,
      dirname: mock((path: string) => path.split("/").slice(0, -1).join("/") || "."),
      rmdir: mock((_path: string, _options?: { recursive: boolean }) => Promise.resolve()),
    };
    
    // Test data
    const writeResults: WriteResult[] = [
      { filePath: "existing-file.js", success: true, linesAdded: 5, linesDeleted: 2 },
      { filePath: "new-file.js", success: true, linesAdded: 10, linesDeleted: 0 },
    ];
    
    const originalStates: WriteOperation[] = [
      {
        block: { filePath: "existing-file.js", fileContent: "// Modified content", startLineNumber: 1 },
        originalContent: "// Original content",
        originallyExisted: true,
      },
      {
        block: { filePath: "new-file.js", fileContent: "// New content", startLineNumber: 5 },
        originalContent: null,
        originallyExisted: false,
      },
    ];
    
    // Execute the revert
    const result = await revertChanges(mockDeps, writeResults, originalStates, "utf-8");
    
    // Verify
    expect(result).toBe(true);
    expect(mockDeps.writeFile).toHaveBeenCalledWith(
      "existing-file.js", 
      "// Original content", 
      "utf-8"
    );
    expect(mockDeps.unlink).toHaveBeenCalledWith("new-file.js");
  });

  test("revertChanges handles special cases", async () => {
    // Create mock dependencies with chalk-like structure
    const mockChalk = {
      red: (text: string) => `RED:${text}`,
      yellow: (text: string) => `YELLOW:${text}`,
      green: (text: string) => `GREEN:${text}`,
      blue: (text: string) => `BLUE:${text}`,
      cyan: (text: string) => `CYAN:${text}`,
      gray: (text: string) => `GRAY:${text}`,
      dim: (text: string) => `DIM:${text}`,
      bold: (text: string) => `BOLD:${text}`,
    } as unknown as typeof chalk;
    
    const mockDeps = {
      writeFile: mock(async (filePath: string) => {
        if (filePath === "error-file.js") {
          throw new Error("Write error");
        }
      }),
      unlink: mock(async (filePath: string) => {
        if (filePath === "error-delete.js") {
          throw new Error("Delete error");
        }
      }),
      log: mock(() => {}),
      error: mock(() => {}),
      chalk: mockChalk,
      exit: mock((code: number) => { throw new Error(`Exit called with code ${code}`); }) as unknown as (code: number) => never,
      dirname: mock((path: string) => path.split("/").slice(0, -1).join("/") || "."),
      rmdir: mock((_path: string, _options?: { recursive: boolean }) => Promise.resolve()),
    };
    
    // Test data for special cases
    const writeResults: WriteResult[] = [
      // File with null original content (existed but couldn't be read)
      { filePath: "null-content.js", success: true, linesAdded: 7, linesDeleted: 0 },
      // File that will error on write
      { filePath: "error-file.js", success: true, linesAdded: 3, linesDeleted: 1 },
      // File that will error on delete
      { filePath: "error-delete.js", success: true, linesAdded: 2, linesDeleted: 0 },
      // File with missing original state
      { filePath: "missing-state.js", success: true, linesAdded: 5, linesDeleted: 0 },
    ];
    
    const originalStates: WriteOperation[] = [
      {
        block: { filePath: "null-content.js", fileContent: "// New content", startLineNumber: 1 },
        originalContent: null,
        originallyExisted: true,
      },
      {
        block: { filePath: "error-file.js", fileContent: "// Modified", startLineNumber: 10 },
        originalContent: "// Original",
        originallyExisted: true,
      },
      {
        block: { filePath: "error-delete.js", fileContent: "// New", startLineNumber: 15 },
        originalContent: null,
        originallyExisted: false,
      },
      // Missing state for "missing-state.js"
    ];
    
    // Execute
    const result = await revertChanges(mockDeps, writeResults, originalStates, "utf-8");
    
    // Verify
    expect(result).toBe(false); // Should fail due to errors
    
    // Should attempt to unlink file with null original content
    expect(mockDeps.unlink).toHaveBeenCalledWith("null-content.js");
    
    // Should attempt to restore content for error-file.js
    expect(mockDeps.writeFile).toHaveBeenCalledWith("error-file.js", "// Original", "utf-8");
    
    // Should attempt to delete file that didn't exist
    expect(mockDeps.unlink).toHaveBeenCalledWith("error-delete.js");
    
    // Should log errors for the problematic files
    expect(mockDeps.error).toHaveBeenCalledTimes(5); // Includes additional messages now
  });
});

// For helper functions and formatters, we'll need to create a separate test file
// as they appear to be internal to the module and not exported 