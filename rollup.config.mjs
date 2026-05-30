import typescript from "@rollup/plugin-typescript";

export default [
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.js",
      format: "cjs",
      sourcemap: false,
      exports: "named"
    },
    plugins: [typescript({ tsconfig: "./tsconfig.json", declaration: false, declarationDir: undefined })]
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.mjs",
      format: "esm",
      sourcemap: false
    },
    plugins: [typescript({ tsconfig: "./tsconfig.json", declaration: false, declarationDir: undefined })]
  }
];
