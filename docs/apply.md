Okay, I will update the README based on the provided codebase, incorporating the missing features like confirmation/revert and the alternative path comment placement, and refine the language for a production-ready feel.

```markdown
# Apply Whole ✨

[![npm version](https://badge.fury.io/js/apply-whole.svg)](https://www.npmjs.com/package/apply-whole)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A blazing fast 🚀 CLI tool, built with [Bun](https://bun.sh/), to extract specially formatted code blocks from markdown and write them directly to your filesystem. Perfect for safely applying patches, setup instructions, or documentation snippets as actual code.

## Features 📋

*   **Clipboard or File Input:** Reads markdown content from your system clipboard or a specified file.
*   **Precise Code Extraction:** Identifies code blocks using a specific comment format (`// path/to/your/file.ext`) placed either on the delimiter line or the line immediately following it.
*   **Filesystem Application:** Writes the extracted code to the corresponding file paths.
*   **Automatic Directory Creation:** Creates necessary directories for target files if they don't exist.
*   **Pre-Analysis:** Scans the markdown for formatting issues (like mismatched delimiters or invalid path comments) *before* applying changes.
*   **Interactive Confirmation:** Prompts the user to confirm the detected changes before writing to the filesystem.
*   **Safe Revert:** Automatically reverts all successful changes if the user declines the confirmation prompt.
*   **Detailed Feedback:** Reports analysis issues and provides clear success/failure status for each file write operation.
*   **Line Change Stats:** Shows the number of lines added and deleted for each successfully written file.
*   **Performance Optimized:** Built with a Bun-first approach for maximum speed.

## Bun-First Approach 🚀

`apply-whole` is built with a Bun-first mindset, leveraging Bun's performance and APIs for:

- **Optimal Performance:** Uses Bun's fast file system APIs and clipboard access.
- **Modern JavaScript/TypeScript:** Takes advantage of the latest language features.
- **Functional Programming:** Follows a functional approach with immutable data structures.
- **Minimal Dependencies:** Relies mostly on built-in capabilities.

While the package *may* work with Node.js, using Bun is strongly recommended for the intended experience and performance.

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

After installation, the `apply` command will be available globally.

## Building from Source

To build and use the development version:

```bash
# 1. Clone the repository
git clone https://github.com/alvamind/apply-whole.git
cd apply-whole

# 2. Install dependencies
bun install

# 3. Build the package (optional, often handled by Bun's runner)
# bun run build

# 4. Link for development (makes `apply` command use local code)
bun link
# Now you can run `apply` in any directory
```

## Usage 🛠️

The core command is `apply`.

**1. From Clipboard:**

*   Copy your markdown content containing the specially formatted code blocks.
*   Run the command in your target directory:
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
    Usage: bun apply [options] # Note: Command is 'apply'

    Applies code blocks from a markdown source to the filesystem.

    Code blocks must be formatted using one of the following styles:

    Style 1: Path on the same line as the opening delimiter
    \`\`\`[language] // path/to/your/file.ext
    File content starts here
    ...
    \`\`\`

    Style 2: Path on the line immediately following the opening delimiter
    \`\`\`[language]
    // path/to/your/file.ext
    File content starts here
    ...
    \`\`\`

    Analysis is performed first. If issues like missing delimiters or
    incorrect start line format are found, they will be reported.
    The tool will attempt to apply any blocks that appear valid.

    Options:
      -i, --input <file>   Specify the input markdown file path.
                           If omitted, reads from the system clipboard.
      -h, --help           Display this help message and exit.
    ```

## How It Works: Markdown Format 📝

The tool looks for standard markdown code blocks (using triple backticks ` ``` `) where the target file path is specified using a specific comment format.

**Required Format (Two Options):**

**Option 1: Path on the same line as the opening delimiter**

````markdown
```typescript // src/utils/helpers.ts
export const greet = (name: string): string => {
  return `Hello, ${name}!`;
};
```
````

**Option 2: Path on the line *immediately following* the opening delimiter**

````markdown
```javascript
// public/scripts/main.js
console.log("Script loaded!");

function initialize() {
  // initialization logic
}

initialize();
```
````

**Key points:**

1.  **Start Delimiter:** Use ` ``` ` optionally followed by a language identifier (e.g., ` ```typescript`).
2.  **Path Comment:** EITHER the line with the opening delimiter OR the *very next line* **must** be a single-line comment (`//`) containing the relative or absolute path to the target file (e.g., `// src/component.tsx`, `// ./styles/main.css`).
3.  **Code Content:** The lines following the path comment (or the line *after* the path comment, if it's on its own line), up until the closing ` ``` `, are treated as the file content.
4.  **End Delimiter:** The block must end with ` ``` `.

## Use Case: Working with LLMs (ChatGPT, Gemini, etc.) 🤖

This tool streamlines applying code generated by Large Language Models. Instruct the LLM to format its output for `apply-whole` to avoid manual copy-pasting.

**Workflow Example:**

1.  **Prompt the LLM:**
    > **You:** "Generate a simple Bun HTTP server in `server.ts` and a corresponding `package.json`. Format the output using markdown code blocks where the file path is specified in a comment like `// path/to/file.ext` on the line immediately after the opening ```."

2.  **LLM Generates Formatted Output:**
    > **LLM:**
    > ```markdown
    > Here are the files:
    >
    > ```typescript
    > // server.ts
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
    > ```json
    > // package.json
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
    *   Run `apply` in your terminal within your project directory:
        ```bash
        apply
        ```
    *   The tool will analyze the blocks, show the intended changes, and prompt for confirmation.

4.  **Confirm or Revert:**
    *   Review the proposed changes listed in the terminal.
    *   Type `y` (or `yes`) and press Enter to apply the changes.
    *   Type `n` (or `no`) and press Enter to safely cancel and revert any potentially staged changes.

5.  **Result:** If confirmed, the tool creates/updates `server.ts` and `package.json`. If declined, no changes are made to your filesystem.

## Analysis and Error Handling 🧐

Before proposing changes, `apply-whole` analyzes the input markdown:

1.  **Delimiter Check:** It checks for an even number of ` ``` ` delimiters. An odd number suggests an unterminated block.
2.  **Path Comment Check:** It verifies that a valid path comment (`// path/to/file.ext`) exists either on the opening delimiter line or the line immediately following it.

If issues are found:

*   They are reported to the console, indicating the line number and the problematic line content.
*   The tool will still attempt to process and apply any blocks that *appear* valid based on the rules.
*   If *no* valid blocks can be extracted due to severe formatting errors, the tool will exit without proposing changes.
*   If any individual file write operation fails *after confirmation* (e.g., due to permissions), it will be reported in the final summary, but previously successful writes in the same run will *not* be automatically reverted.

**Example Output with Confirmation:**

```
$ apply # Assuming valid markdown is on the clipboard
▶ Reading from clipboard...
▶ Analyzing markdown content...
Analysis complete. No issues found.
▶ Applying changes for 2 valid code block(s)...
✔ Written: src/server.ts (+10, -0)
✔ Written: package.json (+10, -3)

Summary:
Attempted: 2 file(s) (2 succeeded, 0 failed)
Lines changed: +20, -3
Completed in 25.50ms

Apply these changes? (y/n): y # User confirms
Changes applied successfully.
Finished successfully.
```

**Example Output with Revert:**

```
$ apply # Assuming valid markdown is on the clipboard
# ... (Analysis and proposed changes shown) ...
Apply these changes? (y/n): n # User declines
Reverting changes...
   Reverted: File src/server.ts deleted. # Or restored if it existed before
   Reverted: File package.json restored.
Changes reverted by user.
Finished successfully.
```

## Contributing 🤝

Contributions are welcome! Feel free to open an issue to report bugs or suggest features, or submit a pull request with improvements. Please ensure code adheres to the functional, immutable, and Bun-first principles of the project.

## License 📜

This project is licensed under the MIT License. See the LICENSE file for details.
```