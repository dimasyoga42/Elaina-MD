import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const plugins = {};

async function loadDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await loadDir(fullPath);
      continue;
    }

    if (!entry.name.endsWith(".js")) continue;

    if (entry.name === "index.js") continue;

    try {
      const fileUrl = new URL(`file://${fullPath}`).href;
      const module = await import(fileUrl);

      if (module.default) {
        plugins[fullPath] = module.default;

        const rel = path.relative(__dirname, fullPath);
        console.log(`Plugin dimuat: ${rel}`);
      } else {
        const rel = path.relative(__dirname, fullPath);
        console.warn(`Plugin "${rel}" tidak punya export default, dilewati.`);
      }
    } catch (err) {
      const rel = path.relative(__dirname, fullPath);
      console.error(`Gagal load plugin "${rel}":`, err);
    }
  }
}

export async function loadPlugins() {
  await loadDir(__dirname);
  return plugins;
}
