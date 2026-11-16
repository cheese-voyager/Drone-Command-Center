import { describe, expect, it, vi } from "vitest";
import { api } from "../src/api/client";

describe("api client", () => {
  it("membaca error koneksi", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    await expect(api<unknown>("http://localhost:8000", "/status")).rejects.toThrow("Tidak bisa menghubungi backend");
  });
});
