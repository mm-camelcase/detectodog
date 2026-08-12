import { mkdir, readdir, copyFile } from "node:fs/promises";
import { join } from "node:path";

async function copyDirectory(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name);
    const to = join(destination, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else await copyFile(from, to);
  }
}

await copyDirectory("public", "dist");
console.log("Copied PWA assets to dist");
