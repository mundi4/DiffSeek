// package.json에 "type": "module" 있거나 .mjs면 ESM임
import { build, defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.NODE_ENV = "production";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, ".."); // 프로젝트 루트
process.chdir(ROOT); // CWD를 루트로 고정
const r = (...p) => path.resolve(ROOT, ...p);

// 1) VENDOR
const vendor = defineConfig({
	define: {
		"process.env.NODE_ENV": '"production"',
		__DEV__: "false", // (여분의 안전벨트)
	},
	build: {
		outDir: "build",
		emptyOutDir: false,
		lib: {
			entry: "./src/vendor.ts",
			name: "Vendor",
			formats: ["iife"],
			fileName: () => "vendor.js",
		},
		minify: true,
		rollupOptions: {
			treeshake: false,
		},
	},
});

// 2) APP
const app = defineConfig({
	define: {
		"process.env.NODE_ENV": '"production"',
		__DEV__: "false", // (여분의 안전벨트)
	},
	plugins: [react(), vanillaExtractPlugin({ identifiers: "debug" })],
	resolve: {
		alias: { "@": r("./src") },
	},
	build: {
		outDir: "build",
		emptyOutDir: false,
		lib: {
			entry: "src/main.tsx",
			name: "App",
			formats: ["iife"],
			fileName: () => "app.js",
		},
		minify: false,
		rollupOptions: {
			external: [
				"react",
				"react-dom",
				"react-dom/client",
				"react/jsx-runtime",
				//"react/jsx-dev-runtime",
				"jotai",
				"jotai/utils",
				"clsx",
				"@vanilla-extract/dynamic",
				"@radix-ui/react-slot",
				"@radix-ui/react-dropdown-menu",
				"@radix-ui/react-toggle",
				"@radix-ui/react-toggle-group",
			],
			output: {
				globals: {
					react: "Vendor.React",
					"react-dom": "Vendor.ReactDOM",
					"react-dom/client": "Vendor.ReactDOM",
					"react/jsx-runtime": "Vendor.ReactJSXRuntime",
					//"react/jsx-dev-runtime": "Vendor.ReactJSXDevRuntime",

					jotai: "Vendor.jotai",
					"jotai/utils": "Vendor.jotaiUtils",
					clsx: "Vendor.clsx",
					"@vanilla-extract/dynamic": "Vendor.VanillaExtractDynamic",
					"@radix-ui/react-slot": "Vendor.RadixUI.Slot",
					"@radix-ui/react-dropdown-menu": "Vendor.RadixUI.DropdownMenuPrimitive",
					"@radix-ui/react-toggle": "Vendor.RadixUI.TogglePrimitive",
					"@radix-ui/react-toggle-group": "Vendor.RadixUI.ToggleGroupPrimitive",
				},
				assetFileNames: (a) => {
					const names = [...(a.names || []), ...(a.originalFileNames || [])];
					const isCss = names.some((n) => n && n.toLowerCase().endsWith(".css")); // 구버전 호환
					return isCss ? "app.css" : "assets/[name]-[hash][extname]";
				},
			},
		},
	},
});

await build(vendor);
await build(app);
