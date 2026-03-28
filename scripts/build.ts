import { execSync } from "child_process";

function run(cmd: string, cwd?: string) {
    console.log(`[build] $ ${cmd}`);
    execSync(cmd, { stdio: "inherit", cwd });
}

run("npm run build -w app");

console.log("[build] 완료");
