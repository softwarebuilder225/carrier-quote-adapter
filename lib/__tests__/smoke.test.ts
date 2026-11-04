import { describe, expect, it } from "vitest";
import pkg from "@/package.json";

describe("vitest setup", () => {
  it("runs TypeScript tests", () => {
    expect(1 + 1).toBe(2);
  });

  it('resolves the "@/" alias to the project root', () => {
    expect(pkg.name).toBe("carrier-quote-adapter");
  });
});
