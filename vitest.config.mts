import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: false,
        environment: "node",
        exclude: ["**/node_modules/**", "tests/Badger.cet.test.ts", "tests/Badger.ny.test.ts", "tests/Badger.la.test.ts"],
        // Type-level tests (tests/*.test-d.ts) get a tsc typecheck pass; the
        // runtime run is unaffected (typecheck.include defaults to *.test-d.ts).
        typecheck: { enabled: true, tsconfig: "./tsconfig.vitest.json" },
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/index.ts"],
            reporter: ["text"],
            thresholds: {
                lines: 100,
                functions: 100,
                branches: 100,
                statements: 100
            }
        }
    }
});
