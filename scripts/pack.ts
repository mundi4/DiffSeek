import { execSync } from "child_process";
import { cpSync, createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import path from "path";

function run(cmd: string, cwd?: string) {
	console.log(`[pack] $ ${cmd}`);
	execSync(cmd, { stdio: "inherit", cwd });
}

// 폴더들
const root = process.cwd();
const appDir = path.join(root, "app");
const distDir = path.join(root, "dist");
const artifactsDir = path.join(root, "artifacts");

const imported = await import("archiver");
const archiver = imported.default || imported;

// 기존 폴더 삭제
if (existsSync(distDir)) rmSync(distDir, { recursive: true, force: true });
if (existsSync(artifactsDir)) rmSync(artifactsDir, { recursive: true, force: true });

mkdirSync(distDir, { recursive: true });
mkdirSync(artifactsDir, { recursive: true });

run("npm run build:pack -w app");

cpSync(path.join(appDir, "dist"), distDir, { recursive: true });

// dist폴더의 모든 css/js파일을 recursive하게 읽어서 하나의 css 문자열로 합치기
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
  법률지원부 ㅅㅈㅅ
  GitHub: https://github.com/mundi4/diffseek
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
</html>
`;

// HTML 파일로 저장
const htmlPath = path.join(artifactsDir, "diffseek.html");
writeFileSync(htmlPath, htmlContent, "utf8");

// ZIP 파일로 저장
const zipPath = path.join(artifactsDir, "diffseek.zip");
const output = createWriteStream(zipPath);
const archive = archiver("zip", { zlib: { level: 9 } });
archive.pipe(output);
archive.file(htmlPath, { name: "diffseek.html" });

// extension 폴더 추가 (문서 파일 제외)
const extensionDir = path.join(root, "extension");
const extensionFiles = readdirSync(extensionDir).filter((f) => !f.endsWith(".md"));
for (const f of extensionFiles) {
	archive.file(path.join(extensionDir, f), { name: `extension/${f}` });
}

await archive.finalize();
await new Promise<void>((resolve, reject) => {
	output.on("close", () => resolve());
	output.on("error", reject);
});

function writeBase64Parts(zipPath: string, outDir: string, begin: string, end: string) {
	const LINE_WIDTH = 64;
	const LINES_PER_PART = 2000;

	mkdirSync(outDir, { recursive: true });

	const b64 = readFileSync(zipPath).toString("base64");
	const lines: string[] = [];
	for (let i = 0; i < b64.length; i += LINE_WIDTH) {
		lines.push(b64.slice(i, i + LINE_WIDTH));
	}

	let part = 0;
	for (let i = 0; i < lines.length; i += LINES_PER_PART) {
		part++;
		const chunk = lines.slice(i, i + LINES_PER_PART);
		const body = [part === 1 ? begin : null, ...chunk, i + LINES_PER_PART >= lines.length ? end : null].filter(
			Boolean,
		);

		writeFileSync(
			path.join(outDir, `part-${String(part).padStart(4, "0")}.txt`),
			body.join("\r\n") + "\r\n",
			"utf8",
		);
	}

	console.log(`[pack] base64 생성 완료: ${path.basename(zipPath)} → ${part}개 (${outDir})`);
}

writeBase64Parts(
	zipPath,
	path.join(artifactsDir, "base64"),
	"-----BEGIN DIFFSEEK ZIP-----",
	"-----END DIFFSEEK ZIP-----",
);

console.log("[pack] 완료");
