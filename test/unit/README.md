# Unit Tests

This directory contains unit tests for the core functionality of the bun-apply tool.

Unit tests focus on testing individual functions and components in isolation, rather than testing the entire application end-to-end.

## Current Tests

- `core.test.ts`: Tests for core markdown analysis functionality
- `args.test.ts`: Tests for command line argument parsing
- `formatters.test.ts`: Tests for result formatting and display

## Running Tests

Run all tests with:

```bash
bun test
```

Or run specific test files:

```bash
bun test test/unit/core.test.ts
``` 