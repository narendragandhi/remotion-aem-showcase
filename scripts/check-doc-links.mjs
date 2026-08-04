import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const markdownFiles = ["README.md", "CONTRIBUTING.md", "DESIGN.md", ...readdirSync("docs").filter((file) => file.endsWith(".md")).map((file) => `docs/${file}`)];
const missing = [];

for (const file of markdownFiles) {
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(/\]\(([^)#]+)(?:#[^)]+)?\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:)/.test(target)) continue;
    if (!existsSync(resolve(dirname(file), target))) missing.push(`${file} -> ${target}`);
  }
}

if (missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}

console.log(`Checked ${markdownFiles.length} Markdown files: all local link targets exist.`);
