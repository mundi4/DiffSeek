import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
	build: {
		target: "esnext",
		outDir: "dist",
		assetsDir: ".",
		emptyOutDir: true,
		assetsInlineLimit: 4096 * 4096,
		minify: "esbuild",
		rolldownOptions: {
			treeshake: true,
			output: {
				format: "iife",
				codeSplitting: false,
			},
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
			"@core": path.resolve(__dirname, "../core/src"),
		},
	},
});
