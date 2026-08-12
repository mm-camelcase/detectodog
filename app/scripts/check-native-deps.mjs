import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const expectedMajor = 13;
const version = require("expo-font/package.json").version;
const major = Number(version.split(".")[0]);

if (major !== expectedMajor) {
  throw new Error(
    `Expo SDK 53 requires expo-font 13.x, but npm resolved ${version}. ` +
      "Run npm install before building the native app.",
  );
}

console.log(`Native dependency check passed: expo-font ${version}`);
