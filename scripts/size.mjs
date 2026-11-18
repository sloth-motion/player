import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BUDGETS = {
  "dist/index.js": 8192,
  "dist/auto.js": 8192,
  "dist/element.js": 8192,
  "dist/sloth.umd.js": 12288,
};

let failed = false;

for (const [file, budget] of Object.entries(BUDGETS)) {
  let source;
  try {
    source = readFileSync(file);
  } catch {
    console.error(`missing build output: ${file} — run \`pnpm build\` first`);
    process.exitCode = 1;
    failed = true;
    continue;
  }
  const gzip = gzipSync(source).length;
  const ok = gzip <= budget;
  if (!ok) failed = true;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${file.padEnd(24)} raw ${String(source.length).padStart(6)} B  gzip ${String(gzip).padStart(5)} B  budget ${budget} B`,
  );
}

if (failed) process.exitCode = 1;
