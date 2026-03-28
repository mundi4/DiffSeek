import { execSync } from "child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";

function run(cmd: string, cwd?: string) {
    console.log(`[build] $ ${cmd}`);
    execSync(cmd, { stdio: "inherit", cwd });
}

const root = process.cwd();
const appDir = path.join(root, "app");
const distDir = path.join(root, "dist");

if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

run("npm run build -w app");

cpSync(path.join(appDir, "dist"), distDir, { recursive: true });

function collectFilesRecursively(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFilesRecursively(fullPath));
            continue;
        }
        files.push(fullPath);
    }

    return files;
}

const allDistFiles = collectFilesRecursively(distDir).sort((a, b) => a.localeCompare(b));

const cssContent = allDistFiles
    .filter((filePath) => path.extname(filePath).toLowerCase() === ".css")
    .map((filePath) => readFileSync(filePath, "utf8"))
    .join("\n");

const jsContent = allDistFiles
    .filter((filePath) => path.extname(filePath).toLowerCase() === ".js")
    .map((filePath) => readFileSync(filePath, "utf8"))
    .join("\n");

const htmlContent = `<!DOCTYPE html>
<!--
  Diffseek
  GitHub: https://github.com/mundi4/DiffSeek
-->
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Diffseek</title>
	<link rel="icon" href="data:image/svg+xml;utf8,
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <rect width='64' height='64' rx='12' fill='%23101010'/>
    <rect x='8' y='12' width='20' height='40' rx='4' fill='%230078ff'/>
    <rect x='36' y='12' width='20' height='40' rx='4' fill='%23ff3d7f'/>
    <rect x='31' y='12' width='2' height='40' fill='%23ffffff'/>
  </svg>" />
	<style>
${cssContent}
	</style>
  </head>
  <body>
    <div id="app"></div>
    <script>
${jsContent.replace(/<\/script>/gi, "<\\/script>")}
    </script>
  </body>
</html
`

writeFileSync(path.join(distDir, "diffseek.html"), htmlContent, "utf8");

console.log("[build] 완료");
