import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve("src/svelte/lib/buildInfo.ts");
const now = new Date();
const builtAtIso = now.toISOString();
const builtAtDisplay = builtAtIso
  .replace("T", " ")
  .replace(/\.\d{3}Z$/, " UTC");

const contents = `export const BUILD_INFO = {
  builtAtIso: ${JSON.stringify(builtAtIso)},
  builtAtDisplay: ${JSON.stringify(builtAtDisplay)},
} as const;
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, contents, "utf8");