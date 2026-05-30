import JavaScriptObfuscator from "javascript-obfuscator";
import { readFileSync, writeFileSync } from "fs";

const targets = ["dist/index.js", "dist/index.mjs"];

for (const file of targets) {
  const source = readFileSync(file, "utf8");
  const result = JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    debugProtection: false,
    disableConsoleOutput: false,
    identifierNamesGenerator: "mangled",
    renameGlobals: false,
    rotateStringArray: true,
    selfDefending: false,
    shuffleStringArray: true,
    splitStrings: false,
    stringArray: true,
    stringArrayCallsTransform: true,
    stringArrayEncoding: ["base64"],
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false
  });
  writeFileSync(file, result.getObfuscatedCode(), "utf8");
  console.log(`Obfuscated: ${file}`);
}
