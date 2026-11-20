import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInThisContext } from "node:vm";
import ts from "typescript";

const modules = new Map();

// Keep Node 20 test compilation in memory, including server-only marker stubbing.
export function loadTypeScriptModule(url, mocks = {}, cache = Object.keys(mocks).length ? new Map() : modules) {
  if (cache.has(url.href)) return cache.get(url.href);
  if (url.pathname.endsWith(".json")) return JSON.parse(readFileSync(url, "utf8"));
  const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const compiledModule = { exports: {} };
  const require = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "server-only") return {};
    if (name.startsWith("@/")) {
      const path = name.slice(2);
      return loadTypeScriptModule(new URL(`../../${path}${path.endsWith(".json") ? "" : ".ts"}`, import.meta.url), mocks, cache);
    }
    throw new Error(`Unexpected runtime dependency: ${name}`);
  };
  const execute = runInThisContext(`(function (module, exports, require) {\n${outputText}\n})`, {
    filename: fileURLToPath(url),
  });
  execute(compiledModule, compiledModule.exports, require);
  cache.set(url.href, compiledModule.exports);
  return compiledModule.exports;
}
