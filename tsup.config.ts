import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      auto: "src/auto.ts",
      element: "src/element.ts",
    },
    format: ["esm", "cjs"],
    dts: false,
    clean: true,
    target: "es2020",
    sourcemap: true,
    treeshake: true,
    splitting: false,
  },
  {
    entry: { sloth: "src/umd.ts" },
    format: ["iife"],
    globalName: "SlothMotion",
    minify: true,
    target: "es2020",
    sourcemap: true,
    outExtension: () => ({ js: ".umd.js" }),
  },
]);
