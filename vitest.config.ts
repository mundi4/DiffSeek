import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [],
	test: {
		globals: true,
		environment: "jsdom",
		pool: "forks",
		setupFiles: [],
		exclude: ["test/minbeop-bench.test.ts", "node_modules/**"],
		outputFile: {
			json: "./test-results.json",
		},
	},
});
