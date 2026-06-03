import { readFileSync, writeFileSync } from "fs";

const files = [
    "dist/Badger.d.ts",
    "dist/BadgerSett.d.ts",
    "dist/BadgerSettings.d.ts",
    "dist/index.d.ts",
];

for (const file of files) {
    let src = readFileSync(file, "utf8");
    // Strip JSDoc blocks (/** ... */)
    src = src.replace(/\/\*\*[\s\S]*?\*\//g, "");
    // Strip single-line /** */ that didn't match above
    src = src.replace(/\/\*[^*][\s\S]*?\*\//g, "");
    // Collapse runs of blank lines left behind
    src = src.replace(/\n{3,}/g, "\n\n");
    writeFileSync(file, src.trim() + "\n", "utf8");
    console.log(`Stripped comments: ${file}`);
}
