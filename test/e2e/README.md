# End-to-End Tests

This directory contains end-to-end tests for the bun-apply tool.

E2E tests run the entire application and test its behavior from input to output, verifying all components work together correctly.

## Current Tests

- `apply.test.ts`: Basic functionality tests for the core CLI application
- `advanced.test.ts`: Advanced tests for edge cases like special paths, encodings, etc.
- `content.test.ts`: Tests focused on various types of file content

## Running Tests

Run all tests with:

```bash
bun test
```

Or run specific test files:

```bash
bun test test/e2e/apply.test.ts
```

## Test Environment

E2E tests use the `setupTestEnvironment` utility to create a temporary directory for each test, allowing tests to create and modify files safely without affecting the real filesystem. 