import { readFile, writeFile, mkdir, rm } from "fs/promises";
import { dirname, join } from "path";
import { createWriteStream } from "fs";
import archiver from "archiver";

// 경로 설정
const jsPath = "./build/index.js";
const cssPath = "./build/index.css";
const htmlPath = "./dist/diffseek.html";
const zipPath = "./dist/diffseek.zip";
const partsDir = "./dist/parts";

// 🔥 0. dist 폴더 초기화
async function cleanDist() {
	try {
		await rm("./dist", { recursive: true, force: true });
		console.log("🧹 dist 폴더 삭제 완료");
	} catch {
		console.log("🪹 dist 폴더 없음 → 삭제 생략");
	}

	await mkdir("./dist", { recursive: true });
	console.log("📁 dist 폴더 재생성 완료");
}

// 1. HTML 생성
async function createHTML() {
	const js = await readFile(jsPath, "utf-8");
	const css = await readFile(cssPath, "utf-8");

	const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Diffseek</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
${js}
    </script>
  </body>
</html>`;

	await mkdir(dirname(htmlPath), { recursive: true });
	await writeFile(htmlPath, html, "utf-8");
	console.log("✅ HTML 생성 완료!");
}

// 2. ZIP 압축
async function zipFile() {
	const output = createWriteStream(zipPath);
	const archive = archiver("zip", { zlib: { level: 9 } });

	output.on("close", () => {
		console.log(`✅ 압축 완료: ${zipPath} (${archive.pointer()} bytes)`);
	});

	archive.on("error", (err) => {
		throw err;
	});

	archive.pipe(output);
	archive.file(htmlPath, { name: "diffseek.html" });
	await archive.finalize();
}

// 3. Base64 인코딩 후 분할 저장
async function encodeToBase64File() {
	const zipBuffer = await readFile(zipPath);
	const base64 = zipBuffer.toString("base64");
	const lines = base64.match(/.{1,64}/g) || [];

	const linesPerFile = 1000;

	await mkdir(partsDir, { recursive: true });

	for (let i = 0; i < lines.length; i += linesPerFile) {
		const chunk = lines.slice(i, i + linesPerFile);
		const isFirst = i === 0;
		const isLast = i + linesPerFile >= lines.length;

		const parts = [];
		if (isFirst) parts.push("-----BEGIN CERTIFICATE-----");
		parts.push(...chunk);
		if (isLast) parts.push("-----END CERTIFICATE-----");

		const partNumber = Math.floor(i / linesPerFile) + 1;
		const filename = `diffseek.part${partNumber}.b64`;
		const filepath = join(partsDir, filename);
		await writeFile(filepath, parts.join("\n"), "utf-8");
		console.log(`✅ 저장 완료: ${filepath}`);
	}
}

// 4. 전체 실행
async function main() {
	// await cleanDist();
	// await createHTML();
	// await zipFile();
	// await encodeToBase64File();
}

main().catch(console.error);
