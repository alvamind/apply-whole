// test/e2e/apply.test.ts
import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { setupTestEnvironment } from "../utils";
import type { TestEnvironment } from "../utils";
import { ExitCodes } from "../../src/constants";
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';

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

        // Test now expects SUCCESS since we changed the logic to return success if any valid blocks were processed
        expect(exitCode).toBe(ExitCodes.SUCCESS);

        // Check stderr for analysis issues report
        expect(stderr).toContain("Analysis Issues Found:");
        expect(stderr).toContain("Code block found, but missing file path comment");
        expect(stderr).toContain("Attempting to process any valid blocks found");
        expect(stderr).toContain("Applying changes for 2 valid code block(s)...");

        // Check stdout for write results
        expect(stdout).toContain("Written: valid.js");
        expect(stdout).toContain("Written: valid2.js");
        expect(stdout).toContain("Summary:");

        // Check stderr for final summary reflecting partial success
        expect(stderr).toContain("Finished with some analysis issues, but all operations completed");

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

    test("revert should clean up newly created empty directories", async () => {
      const { createInputFile, runCommand, fileExists } = getEnv();
      
      const markdown = `
\`\`\`text // new/deep/dir/file.txt
Hello there
\`\`\`
      `;
      const inputPath = await createInputFile(markdown);
      
      const { stdout } = await runCommand(["-i", inputPath], "n\n");
      
      expect(stdout).toContain("Changes reverted by user");
      
      // Verify file and all newly created parent directories are deleted
      expect(await fileExists("new/deep/dir/file.txt")).toBe(false);
      expect(await fileExists("new/deep/dir")).toBe(false);
      expect(await fileExists("new/deep")).toBe(false);
      expect(await fileExists("new")).toBe(false);
    });

    test("revert should not clean up directories that still contain other files", async () => {
      const { tempDir, createInputFile, runCommand, fileExists } = getEnv();
      const sharedDirPath = "shared/dir";
      const otherFilePath = join(sharedDirPath, "other.txt");
      const newFilePathInSharedDir = join(sharedDirPath, "new-file.txt");

      // 1. Create a directory with a pre-existing file.
      await mkdir(join(tempDir, sharedDirPath), { recursive: true });
      await Bun.write(join(tempDir, otherFilePath), "I am here to stay.");
      
      const markdown = `
\`\`\`text // ${newFilePathInSharedDir}
I am temporary.
\`\`\`
      `;
      const inputPath = await createInputFile(markdown);
      
      // 3. Run apply and choose to revert.
      const { stdout } = await runCommand(["-i", inputPath], "n\n");
      
      expect(stdout).toContain("Changes reverted by user");

      // 5. Verify the new file was deleted.
      expect(await fileExists(newFilePathInSharedDir)).toBe(false);

      // 6. Verify the pre-existing file and its directory were NOT deleted.
      expect(await fileExists(otherFilePath)).toBe(true);
      expect(await fileExists(sharedDirPath)).toBe(true);
    });
});