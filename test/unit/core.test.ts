// test/unit/core.test.ts
import { describe, test, expect } from "bun:test";

// We can directly import the function we want to test
import { analyzeMarkdownContent } from "../../src/core";

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
    expect(result.issues[0]?.message).toContain("Invalid code block start tag format");
    expect(result.validBlocks.length).toBe(0);
  });

  test("analyzeMarkdownContent should identify issues with unmatched delimiters", () => {
    const markdown = `
\`\`\`js // path/to/file.js
const x = 1;
`;

    const result = analyzeMarkdownContent(markdown);
    
    expect(result.issues.length).toBe(1);
    expect(result.issues[0]?.message).toContain("odd number");
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
});

// For helper functions and formatters, we'll need to create a separate test file
// as they appear to be internal to the module and not exported 