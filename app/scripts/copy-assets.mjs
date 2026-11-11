import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function copyAssets(
  sourceDirectory,
  destinationDirectory,
  { excludeDirectories = [] } = {},
) {
  mkdirSync(destinationDirectory, { recursive: true });
  for (const name of readdirSync(sourceDirectory)) {
    if (excludeDirectories.includes(name)) continue;
    cpSync(
      join(sourceDirectory, name),
      join(destinationDirectory, name),
      { recursive: true, force: true },
    );
  }

  // Remove flat sprite copies left by earlier builds after the atlases moved.
  const skillTreeDirectory = join(sourceDirectory, "skill-tree");
  if (!existsSync(skillTreeDirectory)) return;
  for (const entry of readdirSync(skillTreeDirectory, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(?:json|webp|png)$/i.test(entry.name)) continue;
    rmSync(join(destinationDirectory, entry.name), { force: true });
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [sourceDirectory, destinationDirectory, ...options] = process.argv.slice(2);
  if (!sourceDirectory || !destinationDirectory) {
    console.error(
      "Usage: node copy-assets.mjs <sourceDirectory> <destinationDirectory> [--exclude <directory>]",
    );
    process.exitCode = 1;
  } else {
    const excludeDirectories = [];
    for (let index = 0; index < options.length; index += 1) {
      if (options[index] === "--exclude" && options[index + 1]) {
        excludeDirectories.push(options[index + 1]);
        index += 1;
      }
    }
    copyAssets(sourceDirectory, destinationDirectory, { excludeDirectories });
  }
}
