import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/core/index.ts"),
      name: "CoreLib", // 원하는 네임
      fileName: "core",
      formats: ["es", "iife"], // 원하는 형식만 선택 가능
    },
    outDir: "build-core", // 결과물 위치
    emptyOutDir: true,
    sourcemap: false,
    minify: false,
    rollupOptions: {
      external: [], // 외부 의존성 지정 (필요시)
    },
  },
});
