export * from "./src/core";

if (import.meta.main) {
  const { runApply, createDefaultDependencies } = await import("./src/core");
  const deps = await createDefaultDependencies();
  
  runApply(deps, Bun.argv).catch((error: unknown) => {
    console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
} 