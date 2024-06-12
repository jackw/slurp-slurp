import { readFileSync, readdirSync, lstatSync } from "fs";
import { join } from "path";
import { SourceMapConsumer } from "source-map";

// Function to parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const argObj = {};

  args.forEach((arg) => {
    const [key, value] = arg.split("=");
    argObj[key.replace("--", "")] = value;
  });

  return argObj;
}

// Function to find the specified package in a source map
async function findPackageInSourceMap(mapPath, packageName) {
  const rawSourceMap = JSON.parse(readFileSync(mapPath, "utf-8"));
  const smc = await new SourceMapConsumer(rawSourceMap);

  let found = false;
  smc.sources.forEach((source) => {
    if (source.includes(packageName)) {
      found = true;
    }
  });
  smc.destroy();
  return found;
}

// Function to recursively find all .map files in a directory
function findSourceMaps(directory) {
  let sourceMaps = [];
  readdirSync(directory).forEach((file) => {
    const fullPath = join(directory, file);
    if (lstatSync(fullPath).isDirectory()) {
      sourceMaps = sourceMaps.concat(findSourceMaps(fullPath));
    } else if (file.endsWith(".map")) {
      sourceMaps.push(fullPath);
    }
  });
  return sourceMaps;
}

(async () => {
  const args = parseArgs();
  const directoryToScan = args.dir;
  const packageName = args.find;

  if (!directoryToScan || !packageName) {
    console.error("Please provide both --dir and --find arguments");
    process.exit(1);
  }

  const sourceMaps = findSourceMaps(directoryToScan);

  for (const map of sourceMaps) {
    const found = await findPackageInSourceMap(map, packageName);
    if (found) {
      console.log(`Found ${packageName} in source map: ${map}`);
    }
  }
})();
