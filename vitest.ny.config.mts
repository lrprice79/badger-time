import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: false,
        environment: "node",
        include: ["tests/Badger.ny.test.ts"]
    }
});
