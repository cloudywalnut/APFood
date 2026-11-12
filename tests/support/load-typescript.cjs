const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { transformSync } = require("next/dist/build/swc");

// Compile isolated server modules with explicit dependency fakes, without Next's
// request cookie runtime or a connection to a hosted service.
exports.loadTypescript = function loadTypescript(filename, mocks = {}, cache = new Map()) {
  filename = path.resolve(filename);
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = new Module(filename);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  cache.set(filename, loaded);
  const nativeRequire = Module.createRequire(filename);
  loaded.require = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith(".")) {
      const target = path.resolve(path.dirname(filename), name);
      const source = target.endsWith(".ts") ? target : target + ".ts";
      if (fs.existsSync(source)) return loadTypescript(source, mocks, cache);
    }
    return nativeRequire(name);
  };
  const compiled = transformSync(fs.readFileSync(filename, "utf8"), {
    jsc: { parser: { syntax: "typescript" }, target: "es2022" },
    module: { type: "commonjs" },
    filename,
  });
  loaded._compile(compiled.code, filename);
  return loaded.exports;
};
