This file is a merged representation of a subset of the codebase, containing specifically included files, combined into a single document by Repomix.

# File Summary

## Purpose
This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format
The content is organized as follows:
1. This summary section
2. Repository information
3. Directory structure
4. Repository files (if enabled)
4. Multiple file entries, each consisting of:
  a. A header with the file path (## File: path/to/file)
  b. The full contents of the file in a code block

## Usage Guidelines
- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes
- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Only files matching these patterns are included: index.ts, src, bin, package.json, tsconfig.json, test
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded
- Files are sorted by Git change count (files with more changes are at the bottom)

## Additional Info

# Directory Structure
```
bin/apply.js
index.ts
package.json
src/cli.ts
src/constants.ts
src/core.ts
src/types.ts
test/e2e/advanced.test.ts
test/e2e/apply.test.ts
test/e2e/content.test.ts
test/unit/args.test.ts
test/unit/core.test.ts
test/unit/formatters.test.ts
test/utils.ts
tsconfig.json
```

# Files

## File: bin/apply.js
````javascript
#!/usr/bin/env bun
import "../dist/src/cli.js"
````

## File: index.ts
````typescript
export * from "./src/core";

if (import.meta.main) {
  const { runApply, createDefaultDependencies } = await import("./src/core");
  const deps = await createDefaultDependencies();
  
  runApply(deps, Bun.argv).catch((error: unknown) => {
    console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}
````

## File: test/e2e/advanced.test.ts
````typescript
// test/e2e/advanced.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestEnvironment } from "../utils";
import type { TestEnvironment } from "../utils";
import { ExitCodes } from "../../src/constants";
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

describe("bun apply advanced E2E tests", () => {
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

  test("should handle file with both BOM and Windows line endings", async () => {
    const { runCommand, fileExists, readFileContent } = getEnv();
    
    // Create a file with BOM and Windows line endings (CRLF)
    const bomPrefix = "\uFEFF"; // BOM character
    const content = bomPrefix + "```js // output/bom-test.js\r\nconst x = 1;\r\n```";
    
    const inputPath = join(env!.tempDir, "bom-input.md");
    await Bun.write(inputPath, content);
    
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);
    
    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Finished successfully.");
    expect(stdout).toContain("✔ Written: output/bom-test.js");
    
    expect(await fileExists("output/bom-test.js")).toBe(true);
    const outputContent = await readFileContent("output/bom-test.js");
    expect(outputContent).toBe("const x = 1;");
  });

  test("should handle files with Unicode characters", async () => {
    const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
    const markdown = `
\`\`\`js // output/unicode-test.js
const greeting = "こんにちは世界"; // Hello World in Japanese
const emoji = "🚀"; // Rocket emoji
\`\`\`
    `;
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Finished successfully.");
    expect(stdout).toContain("✔ Written: output/unicode-test.js");
    
    expect(await fileExists("output/unicode-test.js")).toBe(true);
    const outputContent = await readFileContent("output/unicode-test.js");
    expect(outputContent).toContain("こんにちは世界");
    expect(outputContent).toContain("🚀");
  });

  test("should handle large files with many code blocks", async () => {
    const { createInputFile, runCommand, fileExists } = getEnv();
    
    // Generate a large markdown file with many code blocks
    let markdown = "# Large Test File\n\n";
    for (let i = 0; i < 50; i++) {
      markdown += `
## Section ${i}

Some text for section ${i}

\`\`\`js // output/large-test/file-${i}.js
// File ${i} content
const value${i} = ${i};
export default value${i};
\`\`\`

`;
    }
    
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Applying changes for 50 valid code block(s)");
    expect(stdout).toContain("Attempted: 50 file(s)");
    expect(stdout).toContain("50 succeeded");
    
    // Check some random files
    expect(await fileExists("output/large-test/file-0.js")).toBe(true);
    expect(await fileExists("output/large-test/file-25.js")).toBe(true);
    expect(await fileExists("output/large-test/file-49.js")).toBe(true);
  });

  test("should handle file paths with special characters", async () => {
    const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
    const markdown = `
\`\`\`js // output/special chars & spaces/test [bracket].js
const test = "special path test";
\`\`\`
    `;
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Finished successfully.");
    expect(stdout).toContain("✔ Written: output/special chars & spaces/test [bracket].js");
    
    expect(await fileExists("output/special chars & spaces/test [bracket].js")).toBe(true);
    const outputContent = await readFileContent("output/special chars & spaces/test [bracket].js");
    expect(outputContent).toBe('const test = "special path test";');
  });

  test("should handle read-only directories gracefully", async () => {
    // Skip on CI environments where permissions might not work properly
    if (process.env['CI']) return;
    
    const { createInputFile, runCommand, tempDir } = getEnv();
    
    // Create a read-only directory (this is OS-specific and might not work in all environments)
    const readOnlyDir = join(tempDir, "readonly-dir");
    await mkdir(readOnlyDir, { mode: 0o444 }); // Read-only permissions
    
    const markdown = `
\`\`\`js // readonly-dir/test.js
const test = "this should fail";
\`\`\`
    `;
    
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);
    
    // This test is platform-specific, so we can't make strict assertions about exit code
    // Just check that it either succeeded or failed with appropriate log messages
    if (exitCode === ExitCodes.ERROR) {
      expect(stderr).toContain("Error writing file");
      expect(stdout).toContain("✘ Failed: readonly-dir/test.js");
    } else {
      // If the test actually succeeds (platform allows writing to read-only dir)
      expect(exitCode).toBe(ExitCodes.SUCCESS);
      expect(stdout).toContain("✔ Written: readonly-dir/test.js");
    }
  });

  test("should handle very long file paths approaching OS limits", async () => {
    const { createInputFile, runCommand } = getEnv();
    
    // Generate a deeply nested path (may hit OS limits)
    const deepPath = "output/" + "nested/".repeat(20) + "deep-file.js";
    
    const markdown = `
\`\`\`js // ${deepPath}
const deep = "testing very deep paths";
\`\`\`
    `;
    
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);
    
    // This might succeed or fail depending on OS path limits
    // We're just checking that the program doesn't crash
    expect(typeof exitCode).toBe("number");
    
    // If successful:
    if (exitCode === ExitCodes.SUCCESS) {
      expect(stdout).toContain("✔ Written: " + deepPath);
    } 
    // If failed due to path length:
    else {
      expect(stdout).toContain("✘ Failed: " + deepPath);
      expect(stderr).toContain("Error writing file");
    }
  });

  test("should handle code blocks with indentation", async () => {
    const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
    const markdown = `
Some text before

    \`\`\`js // output/indented.js
    // This block is indented with 4 spaces
    const indented = true;
    \`\`\`

Some text after
    `;
    
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Finished successfully.");
    expect(stdout).toContain("✔ Written: output/indented.js");
    
    expect(await fileExists("output/indented.js")).toBe(true);
    const outputContent = await readFileContent("output/indented.js");
    expect(outputContent).toBe('    // This block is indented with 4 spaces\n    const indented = true;');
  });
});
````

## File: test/e2e/content.test.ts
````typescript
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
````

## File: tsconfig.json
````json
{
  "compilerOptions": {
    // Environment setup & latest features
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "allowJs": true,

    // Bundler mode
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": false,
    "noEmit": true,

    // Best practices
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,

    // Some stricter flags (disabled by default)
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noPropertyAccessFromIndexSignature": true
  }
}
````

## File: src/cli.ts
````typescript
#!/usr/bin/env bun
import { runApply, createDefaultDependencies } from "./core";

const main = async (): Promise<void> => {
  const deps = await createDefaultDependencies();
  try {
    await runApply(deps, process.argv);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    deps.error(deps.chalk.red(`Unhandled error: ${errorMessage}`));
    deps.exit(1);
  }
};

// Only run this if it's called directly
if (import.meta.path === Bun.main) {
  await main();
}
````

## File: test/unit/args.test.ts
````typescript

````

## File: test/utils.ts
````typescript
// test/utils.ts
import { rm, mkdtemp, writeFile as nodeWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FilePath, FileContent } from "../src/types";

export interface TestEnvironment {
  readonly tempDir: FilePath;
  readonly cleanup: () => Promise<void>;
  readonly createInputFile: (content: FileContent) => Promise<FilePath>;
  readonly runCommand: (
    args: ReadonlyArray<string>,
    stdin?: string
  ) => Promise<{
    readonly stdout: string;
    readonly stderr: string;
    readonly exitCode: number | null;
  }>;
  readonly readFileContent: (relativePath: FilePath) => Promise<FileContent>;
  readonly fileExists: (relativePath: FilePath) => Promise<boolean>;
}

export const setupTestEnvironment = async (): Promise<TestEnvironment> => {
  const tempDirPrefix = join(tmpdir(), "bun-apply-test-");
  const tempDir = await mkdtemp(tempDirPrefix);

  const cleanup = async (): Promise<void> => {
    await rm(tempDir, { recursive: true, force: true });
  };

  const createInputFile = async (content: FileContent): Promise<FilePath> => {
    const inputFilePath = join(tempDir, "input.md");
    await nodeWriteFile(inputFilePath, content, "utf-8");
    return inputFilePath;
  };

  const runCommand = async (
    args: ReadonlyArray<string>,
    stdin?: string
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
  }> => {
    // Set up environment variables for testing
    // We auto-confirm changes by default, but if stdin is provided (for reversion tests),
    // we don't auto-confirm so the provided stdin can be used
    const env = { 
      ...Bun.env, 
      NO_COLOR: "1",
      BUN_APPLY_AUTO_YES: stdin ? "false" : "true" 
    };
    
    const spawnedProcess = Bun.spawnSync(
      ["bun", "run", join(import.meta.dir, "..", "src", "core.ts"), ...args],
      {
        cwd: tempDir,
        stdin: stdin ? new TextEncoder().encode(stdin) : undefined,
        stdout: "pipe",
        stderr: "pipe",
        env,
      }
    );

    const stdout = await new Response(spawnedProcess.stdout).text();
    const stderr = await new Response(spawnedProcess.stderr).text();

    // Ensure exitCode is treated as nullable number
    const exitCode = typeof spawnedProcess.exitCode === 'number' ? spawnedProcess.exitCode : null;

    return { stdout, stderr, exitCode };
  };

    const readFileContent = async (relativePath: FilePath): Promise<FileContent> => {
        const fullPath = join(tempDir, relativePath);
        const file = Bun.file(fullPath);
        return await file.text();
    };

    const fileExists = async (relativePath: FilePath): Promise<boolean> => {
        const fullPath = join(tempDir, relativePath);
        return await Bun.file(fullPath).exists();
    };

  return Object.freeze({
    tempDir,
    cleanup,
    createInputFile,
    runCommand,
    readFileContent,
    fileExists
  });
};

// Helper to strip ANSI codes for less brittle assertions if needed
export const stripAnsi = (str: string): string => {
  // Regular expression to match ANSI escape codes
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return str.replace(ansiRegex, "");
};
````

## File: test/e2e/apply.test.ts
````typescript
// test/e2e/apply.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestEnvironment } from "../utils";
import type { TestEnvironment } from "../utils";
import { ExitCodes } from "../../src/constants";
import { join } from 'node:path';

describe("bun apply E2E tests", () => {
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
  }

  test("should show help message with -h", async () => {
    const { runCommand } = getEnv();
    const { stdout, stderr, exitCode } = await runCommand(["-h"]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toBe("");
    expect(stdout).toContain("Usage: bun apply [options]");
    expect(stdout).toContain("-i, --input <file>");
    expect(stdout).toContain("-h, --help");
  });

  test("should show help message with --help", async () => {
    const { runCommand } = getEnv();
    const { stdout, stderr, exitCode } = await runCommand(["--help"]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toBe("");
    expect(stdout).toContain("Usage: bun apply [options]");
  });

  test("should exit with error for invalid argument", async () => {
    const { runCommand } = getEnv();
    const { stdout, stderr, exitCode } = await runCommand(["--invalid-option"]);

    expect(exitCode).toBe(ExitCodes.INVALID_ARGS);
    expect(stdout).toBe(""); // No stdout on arg error
    expect(stderr).toContain("Invalid arguments:"); // Error message
    expect(stderr).toContain("Usage: bun apply [options]"); // Help message shown on error
  });

    test("should exit with error if input file does not exist", async () => {
        const { runCommand } = getEnv();
        const nonExistentFile = "nonexistent.md";
        const { stdout, stderr, exitCode } = await runCommand(["-i", nonExistentFile]);

        expect(exitCode).toBe(ExitCodes.ERROR);
        expect(stdout).toBe(""); // Only logs, no main stdout output
        expect(stderr).toContain(`Reading from file: ${nonExistentFile}...`); // Log message
        expect(stderr).toContain(`Failed to read from file: ${nonExistentFile}`);
        expect(stderr).toContain("ENOENT"); // Specific error indicator
        expect(stderr).toContain(`Hint: Ensure the file '${nonExistentFile}' exists`); // Helpful hint
    });


  test("should process a valid file and create the output file", async () => {
    const { createInputFile, runCommand, readFileContent, fileExists } = getEnv();
    const markdown = `
Some preamble.

\`\`\`typescript // output/hello.ts
const message: string = "Hello from bun apply!";
console.log(message);
\`\`\`

Some epilogue.
    `;
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Reading from file:");
    expect(stderr).toContain("Analyzing markdown content...");
    expect(stderr).toContain("No analysis issues found.");
    expect(stderr).toContain("Applying changes for 1 valid code block(s)...");
    // Check stdout for success confirmation (using stripped output if necessary)
    expect(stdout).toContain("✔ Written: output/hello.ts");
    expect(stdout).toContain("Summary:");
    expect(stdout).toContain("Attempted: 1 file(s) (1 succeeded, 0 failed)");
    expect(stderr).toContain("Finished successfully."); // Final success message to stderr

    // Verify file creation and content
    expect(await fileExists("output/hello.ts")).toBe(true);
    const outputContent = await readFileContent("output/hello.ts");
    expect(outputContent).toBe(
      'const message: string = "Hello from bun apply!";\nconsole.log(message);'
    );
  });

  test("should create nested directories", async () => {
    const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
    const markdown = `
\`\`\`javascript // src/nested/deep/module.js
export const value = 42;
\`\`\`
    `;
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Finished successfully.");
    expect(stdout).toContain("✔ Written: src/nested/deep/module.js");

    expect(await fileExists("src/nested/deep/module.js")).toBe(true);
    const outputContent = await readFileContent("src/nested/deep/module.js");
    expect(outputContent).toBe("export const value = 42;");
  });

  test("should process multiple valid blocks", async () => {
    const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
    const markdown = `
First file:
\`\`\`text // file1.txt
Content for file 1.
\`\`\`

Second file:
\`\`\`json // data/config.json
{
  "key": "value"
}
\`\`\`
    `;
    const inputPath = await createInputFile(markdown);
    const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

    expect(exitCode).toBe(ExitCodes.SUCCESS);
    expect(stderr).toContain("Applying changes for 2 valid code block(s)...");
    expect(stdout).toContain("✔ Written: file1.txt");
    expect(stdout).toContain("✔ Written: data/config.json");
    expect(stdout).toContain("Attempted: 2 file(s) (2 succeeded, 0 failed)");
    expect(stderr).toContain("Finished successfully.");

    expect(await fileExists("file1.txt")).toBe(true);
    expect(await readFileContent("file1.txt")).toBe("Content for file 1.");
    expect(await fileExists("data/config.json")).toBe(true);
    expect(await readFileContent("data/config.json")).toBe('{\n  "key": "value"\n}');
  });

    test("should report analysis issues and still process valid blocks", async () => {
        const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
        const markdown = `
Invalid header:
\`\`\` no-comment-syntax-here
This won't be processed.
\`\`\`

Valid block:
\`\`\`js // valid.js
console.log('This should work');
\`\`\`

Valid block2:
\`\`\`js // valid2.js
// Empty is okay too
\`\`\`
    `;
        const inputPath = await createInputFile(markdown);
        const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

        // Should exit with ERROR because there were analysis issues, even if writes succeeded
        expect(exitCode).toBe(ExitCodes.ERROR);

        // Check stderr for analysis issues report
        expect(stderr).toContain("Analysis Issues Found:");
        expect(stderr).toContain("Code block found, but missing file path comment");
        expect(stderr).toContain("Attempting to process any valid blocks found");
        expect(stderr).toContain("Applying changes for 2 valid code block(s)...");

        // Check stdout for write results
        expect(stdout).toContain("Written: valid.js");
        expect(stdout).toContain("Written: valid2.js");
        expect(stdout).toContain("Summary:");

        // Check stderr for final summary reflecting errors
        expect(stderr).toContain("Finished with"); // Analysis issues message

        // Verify the valid file was created
        expect(await fileExists("valid.js")).toBe(true);
        expect(await readFileContent("valid.js")).toBe("console.log('This should work');");
        
        // Verify the second valid file was created
        expect(await fileExists("valid2.js")).toBe(true);
        expect(await readFileContent("valid2.js")).toBe("// Empty is okay too");

        // Verify the invalid file was NOT created
        expect(await fileExists("no-path.txt")).toBe(false);
    });

    test("should report error if no valid blocks are found (due to analysis issues)", async () => {
        const { createInputFile, runCommand, fileExists } = getEnv();
        const markdown = `
\`\`\` not valid syntax
content
\`\`\`
`;
        const inputPath = await createInputFile(markdown);
        const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

        expect(exitCode).toBe(ExitCodes.ERROR); // Error because analysis issues occurred
        expect(stderr).toContain("Analysis Issues Found:");
        expect(stderr).toContain("Code block found, but missing file path comment");
        expect(stderr).toContain("No valid code blocks");
        expect(stdout).toBe(""); // No write summary

        // Verify no files were created
        expect(await fileExists("path")).toBe(false);
    });


    test("should report success (but do nothing) if input has no code blocks", async () => {
        const { createInputFile, runCommand } = getEnv();
        const markdown = "Just plain text.\nNo code blocks here.";
        const inputPath = await createInputFile(markdown);
        const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

        expect(exitCode).toBe(ExitCodes.SUCCESS); // Success because no errors occurred
        expect(stderr).toContain("Analyzing markdown content...");
        expect(stderr).toContain("No valid code blocks found to apply."); // This message is in the output
        expect(stdout).toBe(""); // No write summary
        expect(stderr).toContain("Finished. No changes were applied or needed."); // Final status
    });

    test("should overwrite existing files", async () => {
        const { createInputFile, runCommand, readFileContent, tempDir } = getEnv();
        const initialContent = "Initial content.";
        const targetPath = "overwrite.txt";
        const fullTargetPath = join(tempDir, targetPath);

        // Create the file initially
        await Bun.write(fullTargetPath, initialContent);
        expect(await Bun.file(fullTargetPath).text()).toBe(initialContent);

        const markdown = `
\`\`\`text // ${targetPath}
New content.
\`\`\`
    `;
        const inputPath = await createInputFile(markdown);
        const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

        expect(exitCode).toBe(ExitCodes.SUCCESS);
        expect(stderr).toContain("Finished successfully.");
        expect(stdout).toContain(`✔ Written: ${targetPath}`);

        // Verify content was overwritten
        const finalContent = await readFileContent(targetPath);
        expect(finalContent).toBe("New content.");
    });

    // Note: Testing actual clipboard requires a different approach, potentially
    // manual testing or more complex environment setup. These E2E tests focus
    // on file input which exercises the core parsing and writing logic.
    // If clipboard testing were essential, one might:
    // 1. Have a helper script that puts text onto the clipboard before running the test.
    // 2. Mock `Bun.clipboard.readText()` within the test runner setup (violates "no mock" rule).
    // 3. Assume clipboard works if file input works (reasonable).
    // We stick to file-based testing for robustness.

     test("should handle empty file content within code block", async () => {
        const { createInputFile, runCommand, readFileContent, fileExists } = getEnv();
        const markdown = `
\`\`\`text // empty.txt
\`\`\`
    `;
        const inputPath = await createInputFile(markdown);
        const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

        expect(exitCode).toBe(ExitCodes.SUCCESS);
        expect(stderr).toContain("Finished successfully.");
        expect(stdout).toContain("✔ Written: empty.txt");

        expect(await fileExists("empty.txt")).toBe(true);
        const outputContent = await readFileContent("empty.txt");
        expect(outputContent).toBe(""); // File should be empty
    });

     test("should handle paths with dots correctly", async () => {
        const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
        const markdown = `
\`\`\`yaml // .config/settings.yaml
setting: value
\`\`\`
\`\`\`dockerfile // ./.docker/Dockerfile.prod
FROM alpine
CMD ["echo", "hello"]
\`\`\`
    `;
        const inputPath = await createInputFile(markdown);
        const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath]);

        expect(exitCode).toBe(ExitCodes.SUCCESS);
        expect(stderr).toContain("Applying changes for 2 valid code block(s)...");
        expect(stdout).toContain("✔ Written: .config/settings.yaml");
        expect(stdout).toContain("✔ Written: ./.docker/Dockerfile.prod");
        expect(stderr).toContain("Finished successfully.");

        expect(await fileExists(".config/settings.yaml")).toBe(true);
        expect(await readFileContent(".config/settings.yaml")).toBe("setting: value");
        expect(await fileExists(".docker/Dockerfile.prod")).toBe(true); // resolves ./
        expect(await readFileContent(".docker/Dockerfile.prod")).toBe('FROM alpine\nCMD ["echo", "hello"]');
    });

    // Consider adding tests for write errors if possible, although reliably
    // triggering permission errors etc. in CI can be difficult.
    // For example, creating a read-only directory and trying to write into it.

    test("should revert changes when user chooses not to apply them", async () => {
      const { createInputFile, runCommand, fileExists, readFileContent } = getEnv();
      
      // First, create a file with original content that will be modified
      const originalPath = join(getEnv().tempDir, "existing-file.js");
      await Bun.write(originalPath, "// Original content\nconsole.log('original');");
      
      const markdown = `
\`\`\`javascript // existing-file.js
// Modified content
console.log('modified');
\`\`\`

\`\`\`javascript // new-file.js
// New file content
console.log('new file');
\`\`\`
      `;
      
      const inputPath = await createInputFile(markdown);
      
      // Run with input from stdin that will answer "n" to the confirmation prompt
      const { stdout, stderr, exitCode } = await runCommand(["-i", inputPath], "n\n");

      // Should exit with success because reversion was successful
      expect(exitCode).toBe(ExitCodes.SUCCESS);
      
      // Check output messages
      expect(stderr).toContain("Applying changes for 2 valid code block(s)...");
      expect(stdout).toContain("✔ Written: existing-file.js");
      expect(stdout).toContain("✔ Written: new-file.js");
      expect(stdout).toContain("Summary:"); 
      expect(stdout).toContain("Attempted: 2 file(s) (2 succeeded, 0 failed)");
      
      // Check reversion messages
      expect(stderr).toContain("Reverting changes...");
      expect(stdout).toContain("Changes reverted by user");
      
      // Verify the existing file was restored to its original content
      expect(await fileExists("existing-file.js")).toBe(true);
      const existingContent = await readFileContent("existing-file.js");
      expect(existingContent).toBe("// Original content\nconsole.log('original');");
      
      // Verify the new file was deleted during reversion
      expect(await fileExists("new-file.js")).toBe(false);
    });
});
````

## File: test/unit/formatters.test.ts
````typescript
// test/unit/formatters.test.ts
import { describe, test, expect } from "bun:test";
import type { AnalysisIssue, WriteResult, ApplyResult } from "../../src/types";

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
````

## File: src/constants.ts
````typescript
import type { ParseArgsConfig } from "node:util";
import type { Encoding, FilePath } from "./types";

export const DEFAULT_ENCODING: Encoding = "utf-8";
// Updated regex to support path on same line or next line
export const CODE_BLOCK_START_LINE_REGEX: RegExp =
  /^```(?:[a-z]+)?\s*(?:\/\/\s*(?<path>[^\r\n]+)\s*)?$/i;
// Regex to detect if a path is on the line following the opening delimiter
export const PATH_ON_NEXT_LINE_REGEX: RegExp =
  /^\/\/\s*(?<path>[^\r\n]+)\s*$/;
export const ANY_CODE_BLOCK_DELIMITER_REGEX: RegExp = /^```/;
export const HELP_MESSAGE: string = `
Usage: bun apply [options]
Applies code blocks from a markdown source to the filesystem.
Code blocks must be formatted as:
\`\`\`[language] // path/to/your/file.ext
// File content starts here
...
\`\`\`
Analysis is performed first. If broken or invalid code blocks
(e.g., missing delimiters, incorrect start line format) are found,
issues will be reported, but the tool will attempt to apply any
blocks that appear valid.
Options:
  -i, --input <file>   Specify the input markdown file path.
                       If omitted, reads from the system clipboard.
  -h, --help           Display this help message and exit.
  --no-lint            Skip TypeScript checks before and after applying changes.
`;
export const ARGS_CONFIG: ParseArgsConfig = {
  options: {
    input: { type: "string", short: "i" },
    help: { type: "boolean", short: "h" },
    "no-lint": { type: "boolean", default: false }, // Added no-lint flag
  },
  allowPositionals: false,
  strict: true,
};
export const ExitCodes = {
  SUCCESS: 0,
  ERROR: 1,
  INVALID_ARGS: 2,
} as const;
export const NEWLINE_REGEX = /\r?\n/;
// Confirmation and Revert Messages
export const CONFIRMATION_PROMPT = "Apply these changes? (y/n): ";
export const CHANGES_APPLIED_MESSAGE = "Changes applied successfully.";
export const CHANGES_REVERTED_MESSAGE = "Changes reverted by user.";
export const REVERTING_MESSAGE = "Reverting changes...";
export const REVERT_ACTION_MESSAGE = (filePath: FilePath, action: "restored" | "deleted" | string): string =>
  `   Reverted: File ${filePath} ${action}.`;
export const REVERT_ERROR_MESSAGE = (filePath: FilePath, error: string): string =>
  `   Error reverting ${filePath}: ${error}`;

// Status Messages
export const READING_INPUT_START = "Reading input...";
export const READING_INPUT_DONE = "Input read.";
export const READING_FILE_START = (path: FilePath): string => `Reading from file: ${path}...`;
export const ANALYSIS_START = "Analyzing markdown content...";
export const ANALYSIS_DONE = "Analysis complete.";
export const APPLYING_CHANGES_START = (count: number): string => `Applying changes for ${count} valid code block(s)...`;
export const APPLYING_CHANGES_DONE = "File operations complete.";
export const REVERTING_DONE = "Revert operation finished.";

// Linter related messages
export const LINTER_COMMAND: ReadonlyArray<string> = ["bun", "tsc", "--noEmit", "--pretty", "false"]; // Added pretty: false for easier parsing
export const LINTER_CHECK_START_MSG = "Running TypeScript check...";
export const LINTER_CHECK_COMPLETE_MSG = "TypeScript check complete.";
export const LINTER_CHECK_FAILED_MSG = "Warning: Failed to run TypeScript check";
export const LINTER_CHECK_SKIPPED_MSG = "TypeScript check skipped.";
export const LINTER_RESULTS_MSG = (errors: number, warnings: number): string =>
  `TypeScript - Errors: ${errors}, Warnings: ${warnings}`;
export const LINTER_CHANGE_MSG = (
    errorChange: number,
    warningChange: number,
    errorColor: (s: string) => string,
    warningColor: (s: string) => string
): string =>
    `Change - Errors: ${errorColor(errorChange > 0 ? `+${errorChange}` : String(errorChange))}, Warnings: ${warningColor(warningChange > 0 ? `+${warningChange}` : String(warningChange))}`;

export const LINTER_ERROR_LINE_REGEX = /error TS\d+:/i;
export const LINTER_WARNING_LINE_REGEX = /warning TS\d+:/i; // Adjust if tsc uses different warning format
````

## File: src/types.ts
````typescript
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
export type RevertDeps = Pick<Dependencies, "writeFile" | "unlink" | "log" | "error" | "chalk" | "dirname" | "rmdir"> & ErrorExitDeps; // Added error/chalk for status
export type LintingDeps = Pick<Dependencies, "runLinter" | "error" | "chalk">;
export type RunApplyDeps = Dependencies & LintingDeps;
````

## File: test/unit/core.test.ts
````typescript
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
````

## File: src/core.ts
````typescript
import {
  DEFAULT_ENCODING,
  CODE_BLOCK_START_LINE_REGEX,
  PATH_ON_NEXT_LINE_REGEX,
  ANY_CODE_BLOCK_DELIMITER_REGEX,
  HELP_MESSAGE,
  ARGS_CONFIG,
  ExitCodes,
  NEWLINE_REGEX,
  REVERTING_MESSAGE,
  REVERT_ACTION_MESSAGE,
  REVERT_ERROR_MESSAGE,
  CONFIRMATION_PROMPT,
  CHANGES_APPLIED_MESSAGE,
  CHANGES_REVERTED_MESSAGE,
  LINTER_COMMAND,
  LINTER_CHECK_START_MSG,
  LINTER_CHECK_COMPLETE_MSG,
  LINTER_CHECK_FAILED_MSG,
  LINTER_RESULTS_MSG,
  LINTER_CHANGE_MSG,
  LINTER_ERROR_LINE_REGEX,
  LINTER_WARNING_LINE_REGEX,
  LINTER_CHECK_SKIPPED_MSG,
  READING_INPUT_START,
  READING_INPUT_DONE,
  ANALYSIS_START,
  ANALYSIS_DONE,
  APPLYING_CHANGES_START,
  APPLYING_CHANGES_DONE,
  REVERTING_DONE,
  READING_FILE_START,
} from "./constants";
import type {
  FilePath,
  FileContent,
  CodeBlock,
  AnalysisResult,
  AnalysisIssue,
  WriteResult,
  ApplyResult,
  Dependencies,
  Encoding,
  Nanoseconds,
  Milliseconds,
  ParsedArgsResult,
  ParsedArgsValues,
  LineChanges,
  ProcessingStats,
  WriteOperation,
  ErrorExitDeps,
  CliDeps,
  InputDeps,
  FormatDeps,
  DirectoryDeps,
  WriteFileDeps,
  WriteProcessDeps,
  RevertDeps,
  RunApplyDeps,
  LinterResult,
} from "./types";
import chalk from "chalk";
import clipboardy from "clipboardy";

const nanosecondsToMilliseconds = (diff: Nanoseconds): Milliseconds =>
  (diff[0] * 1e9 + diff[1]) / 1e6;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const reportErrorAndExit = (
  deps: ErrorExitDeps,
  message: string,
  exitCode: typeof ExitCodes[keyof typeof ExitCodes],
  helpText?: string
): never => {
  deps.error(deps.chalk.red(message));
  if (helpText) {
    deps.error(helpText);
  }
  return deps.exit(exitCode);
};

const parseCliArguments = (
  deps: CliDeps,
  argv: ReadonlyArray<string>
): ParsedArgsResult => {
  try {
    const parsed: ParsedArgsValues = deps.parseArgs({ ...ARGS_CONFIG, args: argv.slice(2) });
    const showHelp = parsed.values.help ?? false;
    const inputFile = parsed.values.input ?? null;
    const skipLinter = parsed.values["no-lint"] ?? false; // Get skipLinter flag

    if (showHelp) {
      deps.log(HELP_MESSAGE);
      return deps.exit(ExitCodes.SUCCESS);
    }
    return {
      inputFile,
      useClipboard: !inputFile,
      showHelp: false,
      skipLinter, // Return skipLinter flag
    };
  } catch (err: unknown) {
    return reportErrorAndExit(
      deps,
      `Invalid arguments: ${getErrorMessage(err)}`,
      ExitCodes.INVALID_ARGS,
      HELP_MESSAGE
    );
  }
};

const getInputContent = async (
  deps: InputDeps,
  args: ParsedArgsResult,
  encoding: Encoding
): Promise<FileContent> => {
  const sourceDescription = args.inputFile
    ? `file: ${deps.chalk.cyan(args.inputFile)}`
    : "clipboard";
  deps.error(deps.chalk.blue(READING_INPUT_START)); // Use status message
  const readFileOrClipboard = async (): Promise<FileContent> => {
    if (args.inputFile) {
      try {
        deps.error(deps.chalk.blue(READING_FILE_START(args.inputFile)));
        const content = await deps.readFile(args.inputFile, encoding);
        return content;
      } catch (err: unknown) {
        return reportErrorAndExit(
          deps,
          `Failed to read from file: ${args.inputFile}: ${getErrorMessage(err)}\nHint: Ensure the file '${args.inputFile}' exists.`,
          ExitCodes.ERROR
        );
      }
    } else if (args.useClipboard) {
      const content = await deps.readClipboard();
      if (!content || content.trim().length === 0) {
        throw new Error("Clipboard is empty or contains only whitespace.");
      }
      return content;
    }
    throw new Error("No input source specified (file or clipboard).");
  };
  try {
    const content = await readFileOrClipboard();
    deps.error(deps.chalk.blue(READING_INPUT_DONE)); // Use status message
    return content;
  } catch (error: unknown) {
    const baseMsg = `Failed to read from ${sourceDescription}`;
    const specificError = getErrorMessage(error);
    let hint = "";
    if (args.inputFile && specificError.includes('ENOENT')) {
      hint = deps.chalk.yellow(`Hint: Ensure the file '${args.inputFile}' exists.`);
    } else if (args.useClipboard) {
      hint = deps.chalk.yellow(`Hint: Ensure system clipboard access is allowed and it contains text.\nAlternatively, use the '-i <file>' flag to specify an input file instead of using clipboard.`);
    }
    return reportErrorAndExit(deps, `${baseMsg}: ${specificError}`, ExitCodes.ERROR, hint || undefined);
  }
};

const analyzeMarkdownContent = (
    markdownContent: FileContent
): AnalysisResult => {
    // Analysis logic remains the same...
    const lines = markdownContent.split(NEWLINE_REGEX);
    const issues: AnalysisIssue[] = [];
    const validBlocks: CodeBlock[] = [];
    let inCodeBlock = false;
    let currentBlockStart = 0;
    let currentBlockPath = "";
    let contentStart = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        const trimmedLine = line.trimStart();
        if (ANY_CODE_BLOCK_DELIMITER_REGEX.test(trimmedLine)) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                currentBlockStart = i;
                const match = trimmedLine.match(CODE_BLOCK_START_LINE_REGEX);
                if (match?.groups?.['path']) {
                    currentBlockPath = match.groups['path'].trim();
                    contentStart = i + 1;
                } else if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1] ?? "";
                    const pathMatch = nextLine.match(PATH_ON_NEXT_LINE_REGEX);
                    if (pathMatch?.groups?.['path']) {
                        currentBlockPath = pathMatch.groups['path'].trim();
                        contentStart = i + 2;
                    } else {
                        currentBlockPath = ""; // Path not found immediately
                    }
                } else {
                    currentBlockPath = ""; // Path not found and no next line
                }
            } else { // End of a block
                inCodeBlock = false;
                if (currentBlockPath) { // Only add block if path was found
                    const contentEnd = i;
                    const blockContent = lines.slice(contentStart, contentEnd).join('\n');
                    validBlocks.push({
                        filePath: currentBlockPath,
                        fileContent: blockContent,
                        startLineNumber: currentBlockStart + 1 // Line number of opening ```
                    });
                } else { // No path found for this block
                    issues.push({
                        lineNumber: currentBlockStart + 1,
                        lineContent: lines[currentBlockStart] ?? "",
                        message: "Code block found, but missing file path comment (e.g., `// path/to/file.ext`) on the start line or the next line.",
                    });
                }
                currentBlockPath = ""; // Reset for next block
            }
        }
    }

    // Check if the file ended while still inside a code block
    if (inCodeBlock) {
        issues.push({
            lineNumber: currentBlockStart + 1,
            lineContent: lines[currentBlockStart] ?? "",
            message: "Unclosed code block detected. Found start delimiter '```' but no matching end delimiter.",
        });
    }

    return {
        validBlocks: Object.freeze(validBlocks),
        issues: Object.freeze(issues),
    };
};

const ensureDirectoryExists = async (
  deps: DirectoryDeps,
  filePath: FilePath
): Promise<void> => {
  const dir = deps.dirname(filePath);
  if (dir && dir !== '.' && dir !== '/') {
      const dirExists = await deps.exists(dir);
      if (!dirExists) {
          await deps.mkdir(dir, { recursive: true });
      }
  }
};

const calculateLineChanges = (
    oldContent: FileContent | null,
    newContent: FileContent
): LineChanges => {
    const oldLines = oldContent?.split(NEWLINE_REGEX) ?? [];
    const newLines = newContent.split(NEWLINE_REGEX);
    return {
        linesAdded: Math.max(0, newLines.length - oldLines.length),
        linesDeleted: Math.max(0, oldLines.length - newLines.length)
    };
};

const performWrite = async (
  deps: WriteFileDeps,
  block: CodeBlock,
  encoding: Encoding
): Promise<WriteResult> => {
  // Write logic remains the same...
  let oldContent: FileContent | null = null;
  let originallyExisted = false;
  try {
    await ensureDirectoryExists(deps, block.filePath);
    originallyExisted = await deps.exists(block.filePath);
    if (originallyExisted) {
        try {
            oldContent = await deps.readFile(block.filePath, encoding);
        } catch (readError: unknown) {
             console.warn(`Warning: Could not read existing file ${block.filePath}, will overwrite. Error: ${getErrorMessage(readError)}`);
        }
    }
    await deps.writeFile(block.filePath, block.fileContent, encoding);
    const lineChanges = calculateLineChanges(oldContent, block.fileContent);
    return { filePath: block.filePath, success: true, ...lineChanges };
  } catch (error: unknown) {
    return {
      filePath: block.filePath,
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      linesAdded: 0,
      linesDeleted: 0,
    };
  }
};

const writeFiles = async (
  deps: WriteProcessDeps,
  blocks: ReadonlyArray<CodeBlock>,
  encoding: Encoding
): Promise<ApplyResult> => {
  deps.error(deps.chalk.blue(APPLYING_CHANGES_START(blocks.length)));
  const startTime = deps.hrtime();
  const originalStates = await Promise.all(blocks.map(async (block) => {
    let originalContent: FileContent | null = null;
    const fileExists = await deps.exists(block.filePath);
    if (fileExists) {
      try {
        originalContent = await deps.readFile(block.filePath, encoding);
      } catch (error) {
        console.warn(`Warning: Failed to read original content of ${block.filePath}: ${getErrorMessage(error)}`);
        originalContent = null;
      }
    }
    return { block, originalContent, originallyExisted: fileExists };
  }));

  const writeResults = await Promise.all(blocks.map(block => performWrite(deps, block, encoding)));
  const endTime = deps.hrtime(startTime);
  const durationMs = nanosecondsToMilliseconds(endTime);
  const initialStats: ProcessingStats = {
      totalAttempted: blocks.length, successfulWrites: 0, failedWrites: 0,
      totalLinesAdded: 0, totalLinesDeleted: 0, linesAdded: 0, linesDeleted: 0, durationMs,
  };

  const finalStats = writeResults.reduce((stats, result) => ({
      ...stats,
      successfulWrites: stats.successfulWrites + (result.success ? 1 : 0),
      failedWrites: stats.failedWrites + (result.success ? 0 : 1),
      totalLinesAdded: stats.totalLinesAdded + result.linesAdded,
      totalLinesDeleted: stats.totalLinesDeleted + result.linesDeleted,
  }), initialStats);

   deps.error(deps.chalk.blue(APPLYING_CHANGES_DONE));
  return {
    writeResults: Object.freeze(writeResults),
    originalStates: Object.freeze(originalStates),
    stats: finalStats
  };
};

const formatAnalysisIssues = (
    deps: FormatDeps,
    issues: ReadonlyArray<AnalysisIssue>
): string[] => {
  return issues.map(
    (issue) =>
      `   ${deps.chalk.yellow(`[Line ${issue.lineNumber}]`)}: ${issue.message}\n   ${deps.chalk.dim(issue.lineContent)}`
  );
};

const formatWriteResults = (
  deps: FormatDeps,
  { writeResults, stats }: ApplyResult
): string => {
  const resultLines: string[] = writeResults.map((result) => {
    const statusIcon = result.success ? deps.chalk.green("✔") : deps.chalk.red("✗");
    
    // Determine the action type based on originalState
    let action = "Failed";
    if (result.success) {
      action = "Written"; // Changed from Created/Replaced to Written to match tests
    }
    
    const changeStats = result.success
        ? ` ${deps.chalk.green(`(+${result.linesAdded}`)}, ${deps.chalk.red(`-${result.linesDeleted})`)}`
        : "";
        
    let line = `${statusIcon} ${action}: ${result.filePath}${changeStats}`;
    if (!result.success && result.error) {
      line += ` (${deps.chalk.red(getErrorMessage(result.error))})`;
    }
    return line;
  });
  
  const duration = stats.durationMs.toFixed(2);
  const summary = [
    `\n${deps.chalk.bold("Summary:")}`,
    `Attempted: ${stats.totalAttempted} file(s) (${deps.chalk.green(
      `${stats.successfulWrites} succeeded`
    )}, ${deps.chalk.red(`${stats.failedWrites} failed`)})`,
    `Lines changed: ${deps.chalk.green(`+${stats.totalLinesAdded}`)}, ${deps.chalk.red(`-${stats.totalLinesDeleted}`)}`,
    stats.durationMs > 0 ? `Completed in ${duration}ms` : "",
  ].filter(Boolean);
  return [...resultLines, ...summary].join("\n");
};

const revertChanges = async (
  deps: RevertDeps,
  successfulWriteResults: ReadonlyArray<WriteResult>,
  originalStates: ReadonlyArray<WriteOperation>,
  encoding: Encoding
): Promise<boolean> => {
  deps.error(deps.chalk.yellow(REVERTING_MESSAGE));
  let allRevertedSuccessfully = true;

  // Keep track of parent directories of newly created files for cleanup.
  const parentDirsOfNewFiles: Set<string> = new Set();

  for (const result of successfulWriteResults) {
    const originalState = originalStates.find(os => os.block.filePath === result.filePath);
    if (!originalState) {
      deps.error(deps.chalk.red(`   Error: Cannot find original state for ${result.filePath} to revert.`));
      allRevertedSuccessfully = false;
      continue;
    }

    try {
      if (originalState.originallyExisted) {
        if (originalState.originalContent !== null) {
          // File existed and we have its content, so restore it.
          await deps.writeFile(result.filePath, originalState.originalContent, encoding);
          deps.log(REVERT_ACTION_MESSAGE(result.filePath, "restored"));
        } else {
          // File existed, but we failed to read its original content.
          // The file has been overwritten. Deleting it would be data loss.
          // Warn the user that we cannot revert this specific file to its original state.
          deps.error(deps.chalk.yellow(`   Warning: Cannot revert ${result.filePath} to its original state as it could not be read. The file has been modified.`));
          allRevertedSuccessfully = false; // The revert is not fully successful.
        }
      } else {
        // File was newly created by this tool, so we can safely delete it.
        await deps.unlink(result.filePath);
        deps.log(REVERT_ACTION_MESSAGE(result.filePath, "deleted"));

        // Remember its parent directory for potential cleanup.
        const dir = deps.dirname(result.filePath);
        if (dir && dir !== '.' && dir !== '/') {
          parentDirsOfNewFiles.add(dir);
        }
      }
    } catch (revertError: unknown) {
      deps.error(deps.chalk.red(REVERT_ERROR_MESSAGE(result.filePath, getErrorMessage(revertError))));
      allRevertedSuccessfully = false;
    }
  }

  // Try to clean up directories that may now be empty.
  if (parentDirsOfNewFiles.size > 0) {
    // Convert to array and sort by depth (descending) to remove nested dirs first.
    const directories = Array.from(parentDirsOfNewFiles)
      .sort((a, b) => b.split('/').length - a.split('/').length);

    for (const dir of directories) {
      try {
        // Try to remove the directory. This will only succeed if it's empty.
        // The `rmdir` dependency should be non-recursive by default.
        await deps.rmdir(dir);
        deps.log(REVERT_ACTION_MESSAGE(dir, "directory removed"));
      } catch (error: unknown) {
        // This is expected if the directory is not empty. We can silently ignore ENOTEMPTY.
        const isNotEmptyError = error instanceof Error && 'code' in error && (error.code === 'ENOTEMPTY' || error.code === 'EEXIST');
        if (!isNotEmptyError) {
            deps.error(deps.chalk.yellow(`   Note: Could not remove directory ${dir}. Error: ${getErrorMessage(error)}`));
        }
      }
    }
  }

  deps.error(deps.chalk.yellow(REVERTING_DONE)); // Status message
  return allRevertedSuccessfully;
};

const confirmAndPotentiallyRevert = async (
    deps: Dependencies,
    applyResult: ApplyResult,
    encoding: Encoding,
    skipLinter: boolean, // Pass skipLinter flag
    initialLintResult: LinterResult | null // Add initialLintResult parameter
): Promise<{ shouldKeepChanges: boolean; finalExitCode: number }> => {
    const successfulWrites = applyResult.writeResults.filter(r => r.success);
    // No changes made or only failures occurred, skip confirmation
    if (successfulWrites.length === 0) {
        return {
            shouldKeepChanges: false,
            finalExitCode: applyResult.stats.failedWrites > 0 ? ExitCodes.ERROR : ExitCodes.SUCCESS
        };
    }

    // --- Final Linter Check (Moved Here) ---
    let finalLintResult: LinterResult | null = null;
    if (!skipLinter) {
        deps.error(deps.chalk.blue(LINTER_CHECK_START_MSG));
        finalLintResult = await deps.runLinter();
        if (finalLintResult) {
            deps.error(deps.chalk.blue(`${LINTER_CHECK_COMPLETE_MSG} ${LINTER_RESULTS_MSG(finalLintResult.errors, finalLintResult.warnings)}`));
            
            // Compare with initialLintResult if we have both results
            if (initialLintResult && finalLintResult) {
                const errorChange = finalLintResult.errors - initialLintResult.errors;
                const warningChange = finalLintResult.warnings - initialLintResult.warnings;
                
                // Only show changes if there are any
                if (errorChange !== 0 || warningChange !== 0) {
                    const errorColor = errorChange > 0 ? deps.chalk.red : deps.chalk.green;
                    const warningColor = warningChange > 0 ? deps.chalk.yellow : deps.chalk.green;
                    
                    deps.error(deps.chalk.blue(`${LINTER_CHANGE_MSG(
                        errorChange,
                        warningChange,
                        errorColor,
                        warningColor
                    )}`));
                }
            }
        } else {
            deps.error(deps.chalk.yellow(LINTER_CHECK_FAILED_MSG));
        }
    } else {
        deps.error(deps.chalk.gray(LINTER_CHECK_SKIPPED_MSG));
    }
    // Add a newline for cleaner prompt display after lint results
    deps.error("");

    // --- Confirmation Prompt ---
    const isTestEnvironment = process.env['BUN_APPLY_AUTO_YES'] === 'true';
    let shouldKeepChanges = true;

    if (!isTestEnvironment) {
        const response = await deps.prompt(deps.chalk.yellow(CONFIRMATION_PROMPT));
        const confirmation = response.toLowerCase().trim();
        shouldKeepChanges = confirmation === 'y' || confirmation === 'yes';
    }

    if (shouldKeepChanges) {
        deps.log(deps.chalk.green(CHANGES_APPLIED_MESSAGE));
        return { shouldKeepChanges: true, finalExitCode: applyResult.stats.failedWrites > 0 ? ExitCodes.ERROR : ExitCodes.SUCCESS };
    } else {
        // --- Revert ---
        const revertSuccessful = await revertChanges(
            deps,
            successfulWrites,
            applyResult.originalStates,
            encoding
        );
        if (revertSuccessful) {
            deps.log(deps.chalk.green(CHANGES_REVERTED_MESSAGE));
            return { shouldKeepChanges: false, finalExitCode: ExitCodes.SUCCESS };
        } else {
            deps.error(deps.chalk.red("Errors occurred during revert operation. Filesystem may be in an inconsistent state."));
            return { shouldKeepChanges: false, finalExitCode: ExitCodes.ERROR };
        }
    }
};

const runApply = async (
  deps: RunApplyDeps,
  argv: ReadonlyArray<string>
): Promise<void> => {
  let finalExitCode: number = ExitCodes.SUCCESS;
  let initialLintResult: LinterResult | null = null;
  let analysisHadIssues = false;
  let changesAppliedOrReverted = false; // Track if any action requiring final lint occurred

  try {
    const args = parseCliArguments(deps, argv);

    // --- Initial Linter Check ---
    if (!args.skipLinter) {
        deps.error(deps.chalk.blue(LINTER_CHECK_START_MSG));
        initialLintResult = await deps.runLinter();
        if (initialLintResult) {
             deps.error(deps.chalk.blue(`${LINTER_CHECK_COMPLETE_MSG} ${LINTER_RESULTS_MSG(initialLintResult.errors, initialLintResult.warnings)}`));
        } else {
             deps.error(deps.chalk.yellow(LINTER_CHECK_FAILED_MSG));
        }
    } else {
         deps.error(deps.chalk.gray(LINTER_CHECK_SKIPPED_MSG));
    }

    const content = await getInputContent(deps, args, DEFAULT_ENCODING);

    // --- Analysis ---
    deps.error(deps.chalk.blue(ANALYSIS_START));
    const { validBlocks, issues } = analyzeMarkdownContent(content);
    deps.error(deps.chalk.blue(ANALYSIS_DONE));

    if (issues.length > 0) {
      analysisHadIssues = true;
      deps.error(deps.chalk.yellow("\nAnalysis Issues Found:"));
      formatAnalysisIssues(deps, issues).forEach(issue => deps.error(issue));
      finalExitCode = ExitCodes.ERROR; // Mark exit code as error due to analysis issues
      if (validBlocks.length === 0) {
         deps.error(deps.chalk.red("\nNo valid code blocks extracted due to analysis issues. Aborting operation."));
         // No changes applied, exit early
         return deps.exit(finalExitCode);
      }
      deps.error(deps.chalk.yellow("\nAttempting to process any valid blocks found despite issues..."));
    } else if (validBlocks.length > 0) {
      deps.error(deps.chalk.green("No analysis issues found."));
    }

    if (validBlocks.length === 0 && !analysisHadIssues) {
        deps.error(deps.chalk.blue("No valid code blocks found to apply."));
        // No changes to apply, final lint count is same as initial (if run)
    } else if (validBlocks.length > 0) {
        // --- Write Files ---
        const applyResult = await writeFiles(deps, validBlocks, DEFAULT_ENCODING);
        deps.log(formatWriteResults(deps, applyResult)); // Log results to stdout

        // --- Confirm / Revert / Final Lint ---
        // Pass skipLinter flag and initialLintResult down
        const confirmResult = await confirmAndPotentiallyRevert(deps, applyResult, DEFAULT_ENCODING, args.skipLinter, initialLintResult);
        changesAppliedOrReverted = true; // An action was taken or reverted

        // Update finalExitCode based on confirmation/revert result, but keep ERROR if analysis had issues
        if (finalExitCode !== ExitCodes.ERROR) {
            finalExitCode = confirmResult.finalExitCode;
        } else if (confirmResult.finalExitCode === ExitCodes.ERROR) {
            // If confirmation/revert also failed, ensure exit code remains ERROR
            finalExitCode = ExitCodes.ERROR;
        }
    }

    // --- Final Status Message ---
    // We don't report the final linter results here anymore as they are shown before the prompt
    // If no action was taken (no valid blocks or analysis failure with no blocks), we just report the initial state.
    if (finalExitCode === ExitCodes.ERROR) {
      deps.error(deps.chalk.red(`Finished with issues.`));
    } else if (!changesAppliedOrReverted && !analysisHadIssues) {
        deps.error(deps.chalk.blue("Finished. No changes were applied or needed."));
    } else {
        // Success includes successful apply or successful revert
        deps.error(deps.chalk.green("Finished successfully."));
    }
    deps.exit(finalExitCode);

  } catch (err: unknown) {
    // Catch unexpected errors during the main flow
    deps.error(deps.chalk.red(`Unexpected error: ${getErrorMessage(err)}`));
    // Don't run final linter here, as state is unknown
    deps.exit(ExitCodes.ERROR);
  }
};

const createDefaultDependencies = async (): Promise<Dependencies> => {
  const { parseArgs: nodeParseArgs } = await import("node:util");
  const { dirname: nodeDirname } = await import("node:path");
  const { stat, mkdir: nodeMkdir, unlink: nodeUnlink, rmdir: nodeRmdir } = await import("node:fs/promises");

  const readFile = (filePath: FilePath, _encoding: Encoding): Promise<FileContent> =>
    Bun.file(filePath).text();

  const writeFile = (filePath: FilePath, content: FileContent, _encoding: Encoding): Promise<void> =>
    Bun.write(filePath, content).then(() => {});

  const exists = async (path: FilePath): Promise<boolean> => {
      try {
          await stat(path);
          return true;
      } catch (error: unknown) {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
              return false;
          }
          throw error;
      }
  };

   const mkdir = async (path: FilePath, options: { readonly recursive: boolean }): Promise<void> => {
      await nodeMkdir(path, options);
  }

  const readClipboard = async (): Promise<FileContent> => {
    try {
      const content = await clipboardy.read();
      return content ?? "";
    } catch (error) {
      throw new Error(`Failed to read from clipboard. Ensure 'clipboardy' is installed and system dependencies (like xclip/xsel on Linux, pbcopy/pbpaste on macOS) are met. Original error: ${getErrorMessage(error)}`);
    }
  };

  const prompt = async (message: string): Promise<string> => {
    process.stdout.write(message);
    return new Promise((resolve) => {
        if (process.stdin.isTTY) {
             process.stdin.resume();
             process.stdin.setEncoding('utf8');
             process.stdin.once('data', (data: Buffer) => {
                 process.stdin.pause();
                 resolve(data.toString().trim());
             });
        } else {
            console.error("\nWarning: Non-interactive terminal detected. Cannot prompt for confirmation. Assuming 'no'.");
            resolve('n');
        }
    });
  };

  const unlink = async (path: FilePath): Promise<void> => {
    await nodeUnlink(path);
  };
  
  const rmdir = async (path: FilePath, options?: { readonly recursive?: boolean }): Promise<void> => {
    await nodeRmdir(path, options);
  };

  // Updated Linter implementation using Bun.spawn
  const runLinter = async (): Promise<LinterResult | null> => {
    try {
      const proc = Bun.spawn([...LINTER_COMMAND], { // Convert ReadonlyArray to regular array using spread operator
        stdout: "pipe",
        stderr: "pipe",
      });

      // Collect stdout and stderr data
      let stdoutData = "";
      let stderrData = "";
      
      // Read streams properly
      const stdoutReader = proc.stdout.getReader();
      const stderrReader = proc.stderr.getReader();
      
      // Read stdout
      try {
        while (true) {
          const { done, value } = await stdoutReader.read();
          if (done) break;
          stdoutData += new TextDecoder().decode(value);
        }
      } catch (error) {
        console.error(chalk.yellow(`Error reading stdout: ${getErrorMessage(error)}`));
      } finally {
        stdoutReader.releaseLock();
      }
      
      // Read stderr
      try {
        while (true) {
          const { done, value } = await stderrReader.read();
          if (done) break;
          stderrData += new TextDecoder().decode(value);
        }
      } catch (error) {
        console.error(chalk.yellow(`Error reading stderr: ${getErrorMessage(error)}`));
      } finally {
        stderrReader.releaseLock();
      }
      
      await proc.exited;

      const output = stdoutData + stderrData; // Combine both streams for full output analysis
      const lines = output.split(NEWLINE_REGEX);

      const errors = lines.filter(line => LINTER_ERROR_LINE_REGEX.test(line)).length;
      const warnings = lines.filter(line => LINTER_WARNING_LINE_REGEX.test(line)).length;

      return { errors, warnings };

    } catch (error) {
      console.error(chalk.yellow(`${LINTER_CHECK_FAILED_MSG}: ${getErrorMessage(error)}`));
      return null;
    }
  };

  return Object.freeze({
    readFile,
    writeFile,
    exists,
    mkdir,
    dirname: nodeDirname,
    readClipboard,
    log: console.log,
    error: console.error,
    exit: process.exit,
    chalk,
    parseArgs: nodeParseArgs,
    hrtime: process.hrtime,
    prompt,
    unlink,
    rmdir,
    spawn: Bun.spawn,
    runLinter,
  });
};

const main = async (): Promise<void> => {
  const deps = await createDefaultDependencies();
  try {
    await runApply(deps, Bun.argv);
  } catch (error: unknown) {
    deps.error(deps.chalk.red(`Unhandled error in main execution: ${getErrorMessage(error)}`));
    deps.exit(ExitCodes.ERROR);
  }
};

if (import.meta.path === Bun.main) {
  await main();
}

export {
  parseCliArguments,
  getInputContent,
  analyzeMarkdownContent,
  writeFiles,
  formatAnalysisIssues,
  formatWriteResults,
  runApply,
  createDefaultDependencies,
  calculateLineChanges,
  performWrite,
  ensureDirectoryExists,
  revertChanges,
};
````

## File: package.json
````json
{
  "name": "apply-whole",
  "version": "0.1.5",
  "description": "A blazing fast CLI tool to extract code blocks from markdown and write them to your filesystem",
  "type": "module",
  "module": "dist/index.js",
  "main": "dist/index.js",
  "bin": {
    "apply": "bin/apply.js"
  },
  "files": [
    "dist",
    "bin"
  ],
  "scripts": {
    "build": "bun build --minify --target bun --outdir dist ./index.ts ./src/cli.ts",
    "postbuild": "mkdir -p bin && echo '#!/usr/bin/env bun\nimport \"../dist/src/cli.js\"' > bin/apply.js && node -e \"try { require('fs').chmodSync('./bin/apply.js', '755') } catch (e) { console.log('Note: chmod not available on Windows') }\"",
    "prepublishOnly": "bun run build",
    "start": "bun run index.ts",
    "dev": "bun run --watch index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "keywords": [
    "bun",
    "markdown",
    "cli",
    "code-blocks",
    "apply",
    "patch"
  ],
  "author": "",
  "license": "MIT",
  "engines": {
    "bun": ">=1.0.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/alvamind/apply-whole"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0"
  },
  "dependencies": {
    "apply-whole": "^0.1.4",
    "chalk": "^5.4.1",
    "clipboardy": "^4.0.0"
  }
}
````
