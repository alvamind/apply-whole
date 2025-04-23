# Apply Whole ✨

[![npm version](https://badge.fury.io/js/apply-whole.svg)](https://www.npmjs.com/package/apply-whole)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) <!-- TODO: Confirm license -->

A blazing fast 🚀 CLI tool, built with [Bun](https://bun.sh/), to extract specially formatted code blocks from markdown and write them directly to your filesystem. Perfect for applying patches, setup instructions, or documentation snippets as actual code.

## Features 📋

*   **Clipboard or File Input:** Reads markdown content from your system clipboard or a specified file.
*   **Precise Code Extraction:** Identifies code blocks using a specific comment format (`// path/to/your/file.ext`).
*   **Filesystem Application:** Writes the extracted code to the corresponding file paths.
*   **Automatic Directory Creation:** Creates necessary directories for target files if they don't exist.
*   **Pre-Analysis:** Scans the markdown for formatting issues (like mismatched delimiters or invalid path comments) *before* applying changes.
*   **Detailed Feedback:** Reports analysis issues and provides clear success/failure status for each file write operation.
*   **Line Change Stats:** Shows the number of lines added and deleted for each successfully written file.
*   **Bun-First:** Optimized for performance using Bun APIs.

## Bun-First Approach 🚀

`apply-whole` is built with a Bun-first mindset, leveraging Bun's performance and APIs for:

- **Optimal Performance:** Uses Bun's fast file system APIs and clipboard access
- **Modern JavaScript/TypeScript:** Takes advantage of the latest language features
- **Functional Programming:** Follows a functional approach with immutable data structures
- **Minimal Dependencies:** Relies mostly on built-in capabilities

While the package works with Node.js, we recommend using Bun for the best experience and performance.

## Installation 📦

```bash
# Using Bun (recommended)
bun add -g apply-whole

# Using npm
npm install -g apply-whole

# Using pnpm
pnpm add -g apply-whole

# Using yarn
yarn global add apply-whole
```

After installation, you'll have the `apply` command available globally.

## Building from Source

To build from source:

```bash
# Clone the repository 
git clone https://github.com/alvamind/apply-whole.git
cd apply-whole

# Install dependencies
bun install

# Build the package
bun run build

# Link for development
bun link
```

## Usage 🛠️

The core command is `apply`.

**1. From Clipboard:**

*   Copy your markdown content containing the specially formatted code blocks.
*   Run the command:
    ```bash
    apply
    ```

**2. From File:**

*   Use the `-i` or `--input` flag followed by the markdown file path:
    ```bash
    apply -i path/to/your/document.md
    ```

**3. Getting Help:**

*   Display the help message with all options:
    ```bash
    apply -h
    ```
    ```
    Usage: bun apply [options] # Note: The command is 'apply' even though the package is 'apply-whole'

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
    ```

## How It Works: Markdown Format 📝

The tool looks for standard markdown code blocks (using triple backticks ` ``` `) where the *first line inside the block* is a comment specifying the target file path.

**Required Format:**

````markdown
Some introductory text...

```typescript // src/utils/helpers.ts
export const greet = (name: string): string => {
  return `Hello, ${name}!`;
};
```

More text...

```javascript // public/scripts/main.js
console.log("Script loaded!");

function initialize() {
  // initialization logic
}

initialize();
```

And maybe a block for configuration:

```json // config/settings.json
{
  "port": 8080,
  "featureFlags": {
    "newDashboard": true
  }
}
```
````

**Key points:**

1.  **Start Delimiter:** Use ` ``` ` optionally followed by a language identifier (e.g., ` ```typescript`).
2.  **Path Comment:** The *very next line* **must** be a single-line comment (`//`) containing the relative or absolute path to the target file. Examples:
    *   `// src/component.tsx`
    *   `// ./styles/main.css`
    *   `// /etc/nginx/sites-available/my-app`
3.  **Code Content:** The lines following the path comment, up until the closing ` ``` `, are treated as the file content.
4.  **End Delimiter:** The block must end with ` ``` `.

## Use Case: Working with LLMs (ChatGPT, Gemini, etc.) 🤖

This tool shines when working with Large Language Models that generate code or configuration. Instead of manually copying and pasting multiple snippets into different files, you can instruct the LLM to format its output for `apply-whole`.

**Workflow Example:**

1.  **Prompt the LLM:**
    > **You:** "Generate a simple Bun HTTP server in `server.ts` and a corresponding `package.json`. Format the output using markdown code blocks, where the first line inside each block is a comment like `// path/to/file.ext`."

2.  **LLM Generates Formatted Output:**
    > **LLM:**
    > ```markdown
    > Here are the files:
    >
    > ```typescript // server.ts
    > import { serve } from "bun";
    >
    > serve({
    >   fetch(req) {
    >     return new Response("Welcome to Bun!");
    >   },
    >   port: 3000,
    > });
    >
    > console.log("Listening on http://localhost:3000");
    > ```
    >
    > ```json // package.json
    > {
    >   "name": "my-bun-app",
    >   "module": "server.ts",
    >   "type": "module",
    >   "devDependencies": {
    >     "@types/bun": "latest"
    >   },
    >   "peerDependencies": {
    >     "typescript": "^5.0.0"
    >   }
    > }
    > ```
    > ```

3.  **Apply the Code:**
    *   Copy the entire markdown response from the LLM.
    *   Run `apply` in your terminal:
        ```bash
        apply # Use the 'apply' command
        ```

4.  **Result:** The tool automatically creates `server.ts` and `package.json` with the generated content in your current directory (or updates them if they exist).

This streamlines the process of turning LLM-generated code into actual project files, saving time and reducing copy-paste errors.

## Analysis and Error Handling 🧐

Before writing any files, `apply-whole` analyzes the input markdown:

1.  **Delimiter Check:** It checks for an even number of ` ``` ` delimiters. An odd number suggests an unterminated block.
2.  **Path Comment Check:** It verifies that the line immediately following an opening ` ``` ` matches the `// path/to/file.ext` format.

If issues are found:

*   They are reported to the console, indicating the line number and the problematic line content.
*   The tool will still attempt to process and apply any blocks that *appear* valid based on the rules.
*   If *no* valid blocks can be extracted due to severe formatting errors, the tool will exit without writing files.
*   If any file write operation fails (e.g., due to permissions), it will be reported in the final summary.

**Example Output with Analysis Issue:**

```
$ apply -i faulty.md
▶ Reading from file: faulty.md...
▶ Analyzing markdown content...

Analysis Issues Found:
   [Line 5]: Invalid code block start tag format. Expected: ```[lang] // path/to/file.ext`
   ```javascript / / missing-comment-marker.js

Attempting to process any valid blocks found...
▶ Applying changes for 1 valid code block(s)...
✔ Written: src/valid-code.ts (+5, -0)

Summary:
Attempted: 1 file(s) (1 succeeded, 0 failed)
Lines changed: +5, -0
Completed in 15.23ms
Finished with issues.
```

## Contributing 🤝

Contributions are welcome! Please open an issue or submit a pull request. (TODO: Add more specific contribution guidelines if needed).

## License 📜

This project is licensed under the MIT License. (TODO: Confirm and link to LICENSE file).