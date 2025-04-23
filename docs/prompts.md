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
