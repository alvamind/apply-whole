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