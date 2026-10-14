// Bundles the extension with esbuild. Three.js is bundled locally —
// MV3 forbids loading code from a CDN.
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const out = "extension/dist";
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

const common = { bundle: true, target: "chrome120", minify: true, sourcemap: false, legalComments: "none" };

await Promise.all([
  build({ ...common, entryPoints: ["extension/src/background.ts"], outfile: `${out}/background.js`, format: "esm" }),
  build({ ...common, entryPoints: ["extension/src/content.ts"], outfile: `${out}/content.js`, format: "iife" }),
  build({ ...common, entryPoints: ["extension/src/options.ts"], outfile: `${out}/options/options.js`, format: "iife" }),
]);

await cp("extension/static", out, { recursive: true });
console.log(`extension built → ${out} (load it unpacked from chrome://extensions)`);
