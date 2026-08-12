import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const expected = {
  "expo-font": 13,
  "expo-file-system": 18,
};

for (const [name, expectedMajor] of Object.entries(expected)) {
  const version = require(`${name}/package.json`).version;
  const major = Number(version.split(".")[0]);
  if (major !== expectedMajor) {
    throw new Error(
      `Expo SDK 53 requires ${name} ${expectedMajor}.x, but npm resolved ${version}. ` +
        "Run npm install before building the native app.",
    );
  }
  console.log(`Native dependency check passed: ${name} ${version}`);
}
