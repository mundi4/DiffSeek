import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from "path"
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [
        react(),
        babel({ presets: [reactCompilerPreset()] })
    ],
    base: './',
    build: {
        target: 'esnext',
        outDir: 'dist',
        emptyOutDir: true,
        minify: "esbuild",
        sourcemap: true,
    },
    server: {
        port: 8200,
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
