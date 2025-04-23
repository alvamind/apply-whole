Code changes rules: 
1. make sure to isolate every files code block with ```typescript // {filePath} ...{content} ```
2. only write new/affected files changes of a codebase. ignore unnaffected

You have to follow these STRICT.md rules:
## Do:

1. Strictly follow requirements
2. Use functional programming techniques exclusively
3. Maintain immutability throughout
4. Use DRY principle across all files
5. Always have bun-first mindset

## Don't:
6. Avoid OOP, classes, or inheritance
7. Avoid traditional methods (use higher order functions instead)
8. Don't write comments
9. Don't use `any` or `unknown` types
10. Do not create code of simulation, stub, mock, etc. you should produce code of real expected features
11. Should not create another files other than these:
   - `src/constants.ts` configuration defaults
   - `src/core.ts` - Core functionality
   - `src/types.ts` - Type definitions

test.md rules below

1. while addressing fail tests, always have a mindset that there must be main program core error to fix rather than make test less strict!!
2. Test cases should be isolated and clean no leftover even on sigterm. even the file creation and cli operation is managed by test files
3. Implement e2e tests for all features with real implementation
4. Create challenging, thorough test cases that fully verify implementation
5. Test cases should match expected requirements
6. Do not create/make test of tricks, simulation, stub, mock, etc. you should produce code of real algorithm
7. Do not create any new file for helper,script etc. just do what prompted.
8. Should not create another files other than these:
   - `test/e2e` and`test/unit` - tests files. FOLLOW test.md rules
   - `test/utils.ts - test utils to be used in test files. 





REQUIREMENTS; ignore test.md , follow strict.md by create npm lib of https://www.npmjs.com/package/apply-whole

so the lib user can use command bun apply -i apply-whole.md or bun apply (auto read from clipboard)

so it;
- Takes a file path as input using the -i flag (like -i apply-whole.md) or auto read from clipboard
- Reads the specified file
- Parses code blocks that specify file paths in the format: ```typescript // src/cli.ts content ```
- Extracts the file path and content from each code block
- Overwrites/write the corresponding files with the extracted content
- show useful stats, use chalk

I have created the mvp below

#!/usr/bin/env bun

import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

interface FileContent {
  filePath: string;
  fileContent: string;
}

// Parse command line arguments
const parseCliArgs = (): string => {
  const { values } = parseArgs({
    options: {
      input: { type: "string", short: "i" },
      help:  { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log("Usage: bun run apply -i <input_file>");
    console.log("Reads code blocks from a markdown file and writes them to corresponding files");
    process.exit(0);
  }

  let input = values.input;
  if (Array.isArray(input)) {
    input = input[0];
  }
  if (typeof input !== "string") {
    console.error("Error: Input file is required (-i flag)");
    console.log("Usage: bun run appl -i <input_file>");
    process.exit(1);
  }

  return input;
};

// Extract code blocks from the markdown content
const extractCodeBlocks = (content: string): FileContent[] => {
  const pattern = /```(?:typescript|ts|js|javascript)?\r?\n\/\/\s*(?<path>[^\r\n]+)\r?\n(?<code>[\s\S]*?)```/g;
  const results: FileContent[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content))) {
    const groups = match.groups;
    if (!groups?.path || groups.code === undefined) continue;
    results.push({
      filePath: groups.path.trim(),
      fileContent: groups.code,
    });
  }

  return results;
};

// Write each extracted file to disk
const writeFiles = (fileContents: FileContent[]): void => {
  for (const { filePath, fileContent } of fileContents) {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, fileContent, "utf-8");
    console.log(`✓ Written to ${filePath}`);
  }
};

// Main entrypoint
const main = (): void => {
  try {
    const inputFile = parseCliArgs();
    const content   = readFileSync(inputFile, "utf-8");
    const files     = extractCodeBlocks(content);

    if (files.length === 0) {
      console.log("No code blocks found in the input file");
      return;
    }

    console.log(`Found ${files.length} code blocks to process`);
    writeFiles(files);
    console.log("All files processed successfully");
  } catch (err: unknown) {
    console.error("Error:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
};

main();
















do 1,2,3 below without accidentally remove features;

1. improve processing performance
2. make the codebase more DRY less code less loc
3. add another stat to summary and to individual files of line addition and deletion count