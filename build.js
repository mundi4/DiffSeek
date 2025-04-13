const fs = require('fs');
const path = require('path');

const inputFile = 'index.html';
const outputFile = 'diffseek.html';

let content = fs.readFileSync(inputFile, 'utf8');
let lines = content.split(/\r?\n/);
let newContent = '';

for (let line of lines) {
  // <script src="..."> (with optional type, inline, etc.)
  let scriptMatch = line.match(/<script[^>]*src="([^"]+)"[^>]*>/i);
  if (scriptMatch) {
    const src = scriptMatch[1];
    const typeMatch = line.match(/type="([^"]+)"/i);
    const typeAttr = typeMatch ? ` type="${typeMatch[1]}"` : '';
    const idMatch = line.match(/id="([^"]+)"/i);
    const idAttr = idMatch ? ` id="${idMatch[1]}"` : ``;//` id="${src}"`;

    const scriptPath = path.resolve(src);
    if (fs.existsSync(scriptPath)) {
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      newContent += `<script${idAttr}${typeAttr}>` + '\n';
      newContent += scriptContent + '\n';
      newContent += `</script>\n`;
    } else {
      console.warn(`⚠️ Warning: Script file not found: ${src}`);
      newContent += line + '\n'; // fallback
    }
    continue;
  }

  // <link href="...">
  let linkMatch = line.match(/<link[^>]*href="([^"]+)"[^>]*>/i);
  if (linkMatch) {
    const href = linkMatch[1];
    const stylePath = path.resolve(href);
    if (fs.existsSync(stylePath)) {
      const styleContent = fs.readFileSync(stylePath, 'utf8');
      newContent += `<style>\n${styleContent}\n</style>\n`;
    } else {
      console.warn(`⚠️ Warning: CSS file not found: ${href}`);
      newContent += line + '\n'; // fallback
    }
    continue;
  }

  // Default line (unchanged)
  newContent += line + '\n';
}

// Write to output file
fs.writeFileSync(outputFile, newContent, 'utf8');
console.log(`✅ Build complete: ${outputFile}`);