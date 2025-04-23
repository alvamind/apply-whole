import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestEnvironment } from "../utils";
import type { TestEnvironment } from "../utils";
import { ExitCodes } from "../../src/constants";

describe("bun apply content-specific E2E tests", () => {
  let env: TestEnvironment | null = null;

  beforeEach(async () => {
    env = await setupTestEnvironment();
  });

  afterEach(async () => {
    if (env) {
      await env.cleanup();
    }
  });

  const getEnv = (): TestEnvironment => {
    if (!env) throw new Error("Test environment not set up");
    return env;
  };

  test("should handle file content with backticks", async () => {
    const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
    const markdown = `
\`\`\`js // output/backticks.js
// Code with backticks
const template = \`This is a template literal with \${variable} interpolation\`;
const codeBlock = "Here's a code block: \`\`\`js console.log('hi')\`\`\`";
\`\`\`
    `;
    
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Finished successfully.");
    expect(stdout).toContain("✔ Written: output/backticks.js");
    
    expect(await fileExists("output/backticks.js")).toBe(true);
    const outputContent = await readFileContent("output/backticks.js");
    expect(outputContent).toContain("template literal with ${variable}");
    expect(outputContent).toContain("```js console.log('hi')```");
  });

  test("should handle file content with escaped characters", async () => {
    const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
    const markdown = `
\`\`\`js // output/escaped.js
const regex = /\\d+\\.\\d+/; // Regex with escaped dots
const path = "C:\\\\Windows\\\\System32"; // Windows path
const newlines = "Line1\\nLine2\\nLine3"; // Escaped newlines
\`\`\`
    `;
    
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Finished successfully.");
    expect(stdout).toContain("✔ Written: output/escaped.js");
    
    expect(await fileExists("output/escaped.js")).toBe(true);
    const outputContent = await readFileContent("output/escaped.js");
    expect(outputContent).toContain("const regex = /\\d+\\.\\d+/;");
    expect(outputContent).toContain("const path = \"C:\\\\Windows\\\\System32\";");
    expect(outputContent).toContain("const newlines = \"Line1\\nLine2\\nLine3\";");
  });

  test("should handle extremely large file content", async () => {
    const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
    
    // Generate a large code block (approx. 100KB)
    let largeContent = "// Large file test\n";
    for (let i = 0; i < 2000; i++) {
      largeContent += `const line${i} = "${i}".repeat(20); // Line ${i} with some padding\n`;
    }
    
    const markdown = `
\`\`\`js // output/large-content.js
${largeContent}
\`\`\`
    `;
    
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Finished successfully.");
    expect(stdout).toContain("✔ Written: output/large-content.js");
    
    expect(await fileExists("output/large-content.js")).toBe(true);
    const outputContent = await readFileContent("output/large-content.js");
    expect(outputContent).toContain("const line0 = \"0\"");
    expect(outputContent).toContain("const line1999 = \"1999\"");
  });

  test("should handle file content with null bytes and special characters", async () => {
    const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
    const markdown = `
\`\`\`js // output/special.js
// String with null byte
const nullByte = "before\\u0000after";
// String with other special chars
const special = "\\u001b[31mred text\\u001b[0m"; // ANSI escape codes
\`\`\`
    `;
    
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Finished successfully.");
    expect(stdout).toContain("✔ Written: output/special.js");
    
    expect(await fileExists("output/special.js")).toBe(true);
    const outputContent = await readFileContent("output/special.js");
    expect(outputContent).toContain("const nullByte = \"before\\u0000after\";");
    expect(outputContent).toContain("const special = \"\\u001b[31mred text\\u001b[0m\";");
  });

  test("should handle mixed binary/text content blocks", async () => {
    const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
    
    // Base64 encoded small PNG image
    const base64Image = `
\`\`\`text // output/image.b64
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==
\`\`\`
    `;
    
    const inputPath = await createInputFile(base64Image);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Finished successfully.");
    expect(stdout).toContain("✔ Written: output/image.b64");
    
    expect(await fileExists("output/image.b64")).toBe(true);
    const outputContent = await readFileContent("output/image.b64");
    expect(outputContent).toBe("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
  });

  test("should handle minified/compact content without newlines", async () => {
    const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
    const markdown = `
\`\`\`js // output/minified.js
const a=1;const b=2;const c=3;function add(a,b){return a+b;}const result=add(a,b);const multiLine="this is a very long string that normally would be wrapped but is on a single line to test minified content handling in the apply tool which should be able to handle it correctly";console.log(result);
\`\`\`
    `;
    
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Finished successfully.");
    expect(stdout).toContain("✔ Written: output/minified.js");
    
    expect(await fileExists("output/minified.js")).toBe(true);
    const outputContent = await readFileContent("output/minified.js");
    expect(outputContent).toContain("const a=1;const b=2;");
    expect(outputContent.includes("\n")).toBe(false); // Should not add newlines
  });

  test("should handle content with only whitespace", async () => {
    const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
    const markdown = `
\`\`\`text // output/whitespace.txt
   
  
       
\`\`\`
    `;
    
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Finished successfully.");
    expect(stdout).toContain("✔ Written: output/whitespace.txt");
    
    expect(await fileExists("output/whitespace.txt")).toBe(true);
    const outputContent = await readFileContent("output/whitespace.txt");
    expect(outputContent).toBe("   \n  \n       ");
  });
}); 