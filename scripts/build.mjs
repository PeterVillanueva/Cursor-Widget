import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, "..");
const distDir = path.join(projectRoot, "dist");
const rendererDist = path.join(distDir, "renderer");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(rendererDist, { recursive: true });

await esbuild.build({
  absWorkingDir: projectRoot,
  entryPoints: [path.join(projectRoot, "src", "main.ts")],
  outfile: path.join(distDir, "main.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  sourcemap: true,
  external: ["electron"],
  logLevel: "info",
});

await esbuild.build({
  absWorkingDir: projectRoot,
  entryPoints: [path.join(projectRoot, "src", "renderer", "overlay.ts")],
  outfile: path.join(rendererDist, "overlay.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  sourcemap: true,
  logLevel: "info",
});

cpSync(
  path.join(projectRoot, "src", "renderer", "overlay.html"),
  path.join(rendererDist, "overlay.html"),
);
cpSync(
  path.join(projectRoot, "src", "renderer", "overlay.css"),
  path.join(rendererDist, "overlay.css"),
);
cpSync(
  path.join(projectRoot, "src", "preload.cjs"),
  path.join(distDir, "preload.cjs"),
);

console.log("Build complete → dist/");
