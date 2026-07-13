import { cp, mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const distDir = resolve(root, "dist");
const clientDir = resolve(distDir, "client");
const serverDir = resolve(distDir, "server");
const openAiDir = resolve(distDir, ".openai");

async function copyIfExists(from, to) {
  try {
    await stat(from);
  } catch {
    return;
  }
  await cp(from, to, { recursive: true, force: true });
}

await mkdir(clientDir, { recursive: true });
await mkdir(serverDir, { recursive: true });
await mkdir(openAiDir, { recursive: true });

await copyIfExists(resolve(distDir, "index.html"), resolve(clientDir, "index.html"));
await copyIfExists(resolve(distDir, "assets"), resolve(clientDir, "assets"));
await copyIfExists(resolve(distDir, "_redirects"), resolve(clientDir, "_redirects"));
await cp(resolve(root, ".openai", "hosting.json"), resolve(openAiDir, "hosting.json"));

await writeFile(
  resolve(serverDir, "index.js"),
  `export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || !url.pathname.split("/").pop().includes(".")) {
      url.pathname = "/index.html";
      url.search = "";
      return env.ASSETS.fetch(new Request(url, request));
    }

    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404) {
      return response;
    }

    url.pathname = "/index.html";
    url.search = "";
    return env.ASSETS.fetch(new Request(url, request));
  },
};
`,
);
