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

// For helper functions and formatters, we'll need to create a separate test file
// as they appear to be internal to the module and not exported 