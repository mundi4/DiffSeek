import path from "path";
import react from "@vitejs/plugin-react-swc";
//import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";


export default defineConfig({
	plugins: [
		react(),
		vanillaExtractPlugin({
			identifiers: "debug",
		}),
		//		tailwindcss(),
		visualizer({
			filename: "build/report.html",
			open: true,
		}),
	],
	server: {
		host: "localhost",
		port: 5173,
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		minify: false,
		// sourcemap: false,
		target: "esnext",
		outDir: "build",
		assetsDir: "",
		modulePreload: false,
		// lib: {
		// 	entry: resolve(__dirname, "src/main.tsx"),
		// 	fileName: "index",
		// 	name: "Diffseek",
		// 	// formats: ["es", "cjs"],
		// },
		// lib: {
		// 	// entry: "src/main.tsx", // 라이브러리의 진입점 파일
		// 	entry: "index.html", // 라이브러리의 진입점 파일
		// 	name: "Diffseek", // 라이브러리 전역 변수 이름
		// 	formats: ["es", "iife"], // 원하는 형식만 선택 가능
		// 	fileName: (format) => `index.${format}.js`, // 출력 파일명
		// },
		rollupOptions: {
			// input: {
			// 	main: resolve(__dirname, "", "index.html"),
			// },
			// external: ["react", "react-dom", "react-dom/client"],
			// output: {
			// 	format: "iife",
			// 	globals: {
			// 		// top-level
			// 		react: "Vendor.React",
			// 		"react-dom": "Vendor.ReactDOM",
			// 		"react-dom/client": "Vendor.ReactDOM",
			// 		jotai: "Vendor.jotai",
			// 		clsx: "Vendor.clsx",

			// 		// Radix UI (너의 네임스페이스 구조 그대로)
			// 		"@radix-ui/react-slot": "Vendor.RadixUI.Slot",
			// 		"@radix-ui/react-dropdown-menu": "Vendor.RadixUI.DropdownMenuPrimitive",
			// 		"@radix-ui/react-toggle": "Vendor.RadixUI.TogglePrimitive",
			// 		"@radix-ui/react-toggle-group": "Vendor.RadixUI.ToggleGroupPrimitive",
			// 	},
			// 	entryFileNames: "[name].js", // Output as a single main.js
			// 	chunkFileNames: "[name].js", // Prevent chunks (everything is bundled)
			// 	assetFileNames: "[name][extname]", // Assets will keep their names intact (no hashing)
			// },
			// external: [
			//     // Exclude specific files from being bundled
			//     path.resolve(__dirname, 'src', 'worker', 'worker.ts'),
			// ],
		},
	},
});
