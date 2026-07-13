import { cp, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const distDir = resolve(root, "dist");
const serverDir = resolve(distDir, "server");
const openAiDir = resolve(distDir, ".openai");

await mkdir(serverDir, { recursive: true });
await mkdir(openAiDir, { recursive: true });

await cp(resolve(root, ".openai", "hosting.json"), resolve(openAiDir, "hosting.json"));

await writeFile(
  resolve(serverDir, "index.js"),
  `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404) {
      return response;
    }

    const url = new URL(request.url);
    url.pathname = "/";
    url.search = "";

    return env.ASSETS.fetch(new Request(url, request));
  },
};
`,
);
