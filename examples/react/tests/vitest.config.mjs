import { defineConfig } from "vitest/config";

// JSX with the automatic runtime (no `import React`), and a browser-like DOM.
export default defineConfig({ esbuild: { jsx: "automatic" }, test: { environment: "jsdom" } });
