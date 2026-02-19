import react from '@vitejs/plugin-react'
import path from "path"
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [
        react({
            babel: {
                plugins: [['babel-plugin-react-compiler']],
            },
        })
    ],
    build: {
        target: 'es2024',
        outDir: 'dist',
        emptyOutDir: true,
        assetsInlineLimit: 4096 * 8,
        minify: false,//'esbuild',
        rollupOptions: {
            output: {
            }
        }
    },
    server: {
        port: 5200,
        open: true,
        fs: {
            allow: [
                '..',
            ]
        }
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "src"),
            "@core": path.resolve(__dirname, "../core/src"),
        },
    },
})
