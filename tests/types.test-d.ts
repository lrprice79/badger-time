import { describe, it, expectTypeOf } from "vitest";
import { Badger, Sett } from "../src/index";
import type { BadgerInstance, BadgerSettInstance } from "../src/index";

// Type-level contract: the `Badger` / `Sett` factory NAMES double as their
// instance TYPES (a value/type declaration merge in src/index.ts), so consumers
// can write `const d: Badger = Badger(...)` with no separate type import. These
// assertions are checked by `vitest --typecheck`; remove the type aliases in
// src/index.ts and this file fails to compile.

describe("Badger / Sett usable as types", () => {
    it("Badger-as-type equals the value Badger() returns", () => {
        expectTypeOf<Badger>().toEqualTypeOf<ReturnType<typeof Badger>>();
    });

    it("Sett-as-type equals the value Sett() returns", () => {
        expectTypeOf<Sett>().toEqualTypeOf<ReturnType<typeof Sett>>();
    });

    it("Badger-as-type is equivalent to BadgerInstance", () => {
        expectTypeOf<Badger>().toEqualTypeOf<BadgerInstance>();
    });

    it("Sett-as-type is equivalent to BadgerSettInstance", () => {
        expectTypeOf<Sett>().toEqualTypeOf<BadgerSettInstance>();
    });

    it("a Badger value is assignable to a Badger-typed binding", () => {
        const d: Badger = Badger("2026-01-01");
        expectTypeOf(d).toEqualTypeOf<Badger>();
    });
});
