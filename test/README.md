# Test Suite for bun-apply

This directory contains tests for the bun-apply tool. The tests are organized into two main categories:

## Unit Tests (`/test/unit/`)

Unit tests focus on testing individual functions in isolation:

- `core.test.ts`: Tests for core markdown analysis functionality
- `args.test.ts`: Tests for command line argument parsing
- `formatters.test.ts`: Tests for result formatting and display

## End-to-End Tests (`/test/e2e/`)

E2E tests run the entire application and verify its behavior from end to end:

- `apply.test.ts`: Basic functionality tests for the CLI application
- `advanced.test.ts`: Advanced tests for edge cases like special paths, encodings, etc.
- `content.test.ts`: Tests focused on various types of file content

## Utilities (`/test/utils.ts`)

Helper functions and utilities used by the tests, including:

- `setupTestEnvironment()`: Creates a temporary test environment
- Functions for file creation, reading, and command execution

## Running Tests

To run all tests:

```bash
bun test
```

To run a specific test file:

```bash
bun test test/e2e/apply.test.ts
```

## Test Statistics

- **Total Test Files**: 6
- **Total Test Cases**: 39
- **Unit Tests**: 12
- **E2E Tests**: 27

## Test Design Principles

1. Tests should be isolated and clean up after themselves
2. Tests should verify real functionality, not mocks or stubs
3. Test cases should be thorough and test edge cases 