import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("🔨 Building DiffSeek...\n");

// 1. Build core with tsc (const enum will be inlined)
console.log("📦 Building core...");
execSync("npm run build", {
  cwd: path.join(__dirname, "core"),
  stdio: "inherit",
});

// 2. Update app vite.config.ts to point to core/dist
console.log("\n🔄 Updating vite config for production...");
const viteConfigPath = path.join(__dirname, "app", "vite.config.ts");
let viteConfig = fs.readFileSync(viteConfigPath, "utf-8");

// Replace @core alias to point to dist
viteConfig = viteConfig.replace(
  /"@core": path.resolve\(__dirname, "\.\.\/core\/src"\)/,
  '"@core": path.resolve(__dirname, "../core/dist")',
);

fs.writeFileSync(viteConfigPath, viteConfig);

// 3. Build app with vite
console.log("\n🏗️  Building app...");
execSync("npm run build", {
  cwd: path.join(__dirname, "app"),
  stdio: "inherit",
});

// 4. Restore vite.config.ts to point to src (for development)
console.log("\n🔄 Restoring vite config for development...");
viteConfig = fs.readFileSync(viteConfigPath, "utf-8");
viteConfig = viteConfig.replace(
  /"@core": path.resolve\(__dirname, "\.\.\/core\/dist"\)/,
  '"@core": path.resolve(__dirname, "../core/src")',
);
fs.writeFileSync(viteConfigPath, viteConfig);

console.log("\n✅ Build complete!");
