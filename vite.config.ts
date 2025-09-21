import path from "path";
import fs from 'fs'
import react from "@vitejs/plugin-react-swc";
import { defineConfig, type Plugin } from "vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";
import type { IncomingMessage, ServerResponse } from "http";

function guessMimeByExt(p: string) {
	const ext = path.extname(p).toLowerCase()
	if (ext === '.png') return 'image/png'
	if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
	if (ext === '.gif') return 'image/gif'
	if (ext === '.webp') return 'image/webp'
	if (ext === '.bmp') return 'image/bmp'
	if (ext === '.svg') return 'image/svg+xml'
	if (ext === '.tif' || ext === '.tiff') return 'image/tiff'
	return 'application/octet-stream'
}

function handler(req: IncomingMessage, res: ServerResponse): void {
	try {
		const url = new URL(req.url ?? '/', 'http://localhost')
		const filePath = url.searchParams.get('path') ?? ''

		if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
			const out = JSON.stringify({ error: 'File not found' })
			res.statusCode = 404
			res.setHeader('Content-Type', 'application/json')
			res.setHeader('Content-Length', Buffer.byteLength(out).toString())
			res.end(out)
			return
		}

		const mime = guessMimeByExt(filePath)
		const buf = fs.readFileSync(filePath)
		const b64 = buf.toString('base64')
		const data_url = `data:${mime};base64,${b64}`

		const out = JSON.stringify({ data_url })
		res.statusCode = 200
		res.setHeader('Content-Type', 'application/json')
		res.setHeader('Content-Length', Buffer.byteLength(out).toString())
		res.end(out)
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : 'internal error'
		const out = JSON.stringify({ error: msg })
		res.statusCode = 500
		res.setHeader('Content-Type', 'application/json')
		res.setHeader('Content-Length', Buffer.byteLength(out).toString())
		res.end(out)
	}
}

const convertImgPlugin: Plugin = {
	name: 'dev-convertimg-endpoint',
	configureServer(server) {
		server.middlewares.use('/convertimg', (req, res) => handler(req, res))
	},
}
export default defineConfig({
	plugins: [
		convertImgPlugin,
		react(),
		vanillaExtractPlugin({
			identifiers: "debug",
		}),
		//		tailwindcss(),
		// visualizer({
		// 	filename: "build/report.html",
		// 	open: true,
		// }),
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
			output: {
				manualChunks: undefined,
			},
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
