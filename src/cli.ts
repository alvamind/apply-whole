#!/usr/bin/env node

import { createDefaultDependencies, runApply } from "./core";

const main = async (): Promise<void> => {
  try {
    const deps = await createDefaultDependencies();
    await runApply(deps, process.argv);
  } catch (error) {
    console.error("Unexpected error occurred:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
};

main(); 