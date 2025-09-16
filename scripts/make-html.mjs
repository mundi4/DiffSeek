import { readFile, writeFile, mkdir, rm, copyFile } from "fs/promises";
import { dirname, join } from "path";
import { createWriteStream } from "fs";
import archiver from "archiver";

/** ✅ 순서 중요: 여기서 복사/병합할 lib 파일을 지정 */
const LIB_FILES = ["./vendor.js"];

/** 경로들 */
const distDir = "./dist";
const partsDir = join(distDir, "parts");
const libDir = "./build";

const appJsPath = "./build/app.js";
const appCssPath = "./build/app.css";
const appHtmlPath = join(distDir, "diffseek.html");
const appZipPath = join(distDir, "diffseek.zip");

const distLibBundle = join(distDir, "vendor.js");
const distLibZip = join(distDir, "vendor.js.zip");

/** =========================
 *  공통 유틸 함수
 *  ======================= */

/** 폴더 보장 */
async function ensureDir(p) {
	await mkdir(p, { recursive: true });
}

/** ZIP 만들기: entries = [{ fsPath, nameInZip }] */
async function zipEntries(outZipPath, entries) {
	await ensureDir(dirname(outZipPath));
	const output = createWriteStream(outZipPath);
	const archive = archiver("zip", { zlib: { level: 9 } });

	const done = new Promise((resolve, reject) => {
		output.on("close", () => {
			console.log(`🗜️ ZIP 완료: ${outZipPath} (${archive.pointer()} bytes)`);
			resolve();
		});
		archive.on("error", reject);
	});

	archive.pipe(output);
	for (const { fsPath, nameInZip } of entries) {
		const stat = await import('fs/promises').then(fs => fs.stat(fsPath));
		if (stat.isDirectory()) {
			archive.directory(fsPath, nameInZip);
		} else {
			archive.file(fsPath, { name: nameInZip });
		}
	}
	await archive.finalize();
	await done;
}

/** 파일을 읽어 base64 → 64자 줄바꿈 → BEGIN/END → N줄 단위로 분할 저장 (certutil 호환) */
async function savePemPartsFromFile(srcPath, outDir, baseName, linesPerFile = 1000) {
	await ensureDir(outDir);
	const buf = await readFile(srcPath);
	const b64 = buf.toString("base64");
	const lines = b64.match(/.{1,64}/g) || [];

	for (let i = 0; i < lines.length; i += linesPerFile) {
		const chunk = lines.slice(i, i + linesPerFile);
		const isFirst = i === 0;
		const isLast = i + linesPerFile >= lines.length;

		const pemLines = [];
		if (isFirst) pemLines.push("-----BEGIN CERTIFICATE-----");
		pemLines.push(...chunk);
		if (isLast) pemLines.push("-----END CERTIFICATE-----");

		const partNumber = Math.floor(i / linesPerFile) + 1;
		const filename = `${baseName}.part${partNumber}.b64`;
		const filepath = join(outDir, filename);
		await writeFile(filepath, pemLines.join("\n"), "utf-8");
		console.log(`✅ 저장: ${filepath}`);
	}
}

/** 파일들 복사 */
async function copyFiles(srcDir, destDir, fileNames) {
	await ensureDir(destDir);
	for (const name of fileNames) {
		const src = join(srcDir, name);
		const dest = join(destDir, name);
		await copyFile(src, dest);
		console.log(`📦 복사: ${src} → ${dest}`);
	}
}

/** 여러 파일을 순서대로 읽어 합치기 */
async function concatFilesTo(filesAbsPaths, destPath, separator = "\n;/* --- separator --- */\n") {
	const pieces = [];
	for (const p of filesAbsPaths) {
		pieces.push(await readFile(p, "utf-8"));
	}
	await ensureDir(dirname(destPath));
	await writeFile(destPath, pieces.join(separator) + "\n", "utf-8");
	console.log(`🧩 병합: ${destPath}`);
}

/** =========================
 *  파이프라인 단계
 *  ======================= */

/** 0) dist 초기화 */
async function cleanDist() {
	await rm(distDir, { recursive: true, force: true }).catch(() => {});
	await ensureDir(distDir);
	console.log("🧹 dist 초기화 완료");
}

/** 1) 앱 HTML 생성 (빌드 JS 인라인 + lib 스크립트 태그) */
async function createHTML() {
	const js = await readFile(appJsPath, "utf-8");
	const css = await readFile(appCssPath, "utf-8");
	const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Diffseek</title>
    <script src="vendor.js"></script>
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
	await ensureDir(dirname(appHtmlPath));
	await writeFile(appHtmlPath, html, "utf-8");
	console.log("✅ HTML 생성: diffseek.html");
}

/** 2) ./lib → ./dist 복사 */
async function copyLibToDist() {
	await copyFiles(libDir, distDir, LIB_FILES);
	console.log(`📚 lib 복사 완료 (${LIB_FILES.length}개)`);
}

/** 3) lib 병합 → dist/lib.js */
async function mergeLibs() {
	const abs = LIB_FILES.map((f) => join(distDir, f));
	await concatFilesTo(abs, distLibBundle);
}

/** 4) diffseek.html → zip → PEM 분할 */
async function packageApp() {
	await zipEntries(appZipPath, [{ fsPath: appHtmlPath, nameInZip: "diffseek.html" }]);
	await savePemPartsFromFile(appZipPath, partsDir, "diffseek");
}

/** 5) lib.js → zip → PEM 분할 */
async function packageLib() {
	await zipEntries(distLibZip, [{ fsPath: distLibBundle, nameInZip: "vendor.js" }]);
	await savePemPartsFromFile(distLibZip, partsDir, "vendor");
}


// 6) extension 폴더 압축 → base64 → parts
const extensionZipPath = join(distDir, "extension.zip");
import { resolve } from "path";
async function packageExtension() {
	// 루트의 extension 폴더 전체를 압축
	await zipEntries(extensionZipPath, [{ fsPath: resolve("extension"), nameInZip: "extension" }]);
	await savePemPartsFromFile(extensionZipPath, partsDir, "extension");
}

/** 전체 실행 */
async function main() {
	await cleanDist();

	// 1) 앱 HTML
	await createHTML();

	// 2) 라이브러리 복사 & 병합
	await copyLibToDist();
	await mergeLibs();

	// 3) 패키징 (중복 제거된 공통 유틸 재사용)
	await packageApp();
	await packageLib();

	// 4) extension 폴더 압축 및 분할
	await packageExtension();



	console.log("🎯 모든 작업 완료");
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
