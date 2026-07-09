import { afterEach, describe, expect, it, vi } from "vitest";
import { createCuratorUuid } from "../../../../src/renderer/src/features/curator/core/curatorIds";

// 无连接符 UUID 格式。
const COMPACT_UUID_PATTERN = /^[\da-f]{32}$/i;

// 原始 crypto 对象。
const originalCrypto = globalThis.crypto;

describe("createCuratorUuid", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
  });

  it("移除 randomUUID 生成结果中的连接符", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
      "11111111-1111-4111-8111-111111111111",
    );

    const id = createCuratorUuid();

    expect(id).toBe("11111111111141118111111111111111");
    expect(id).toMatch(COMPACT_UUID_PATTERN);
    expect(id).not.toContain("-");
  });

  it("在 randomUUID 不可用时创建 32 位无连接符 UUID", () => {
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues: (bytes: Uint8Array) => {
          for (let index = 0; index < bytes.length; index += 1) {
            bytes[index] = index;
          }

          return bytes;
        },
      },
    });

    const id = createCuratorUuid();

    expect(id).toMatch(COMPACT_UUID_PATTERN);
    expect(id).toHaveLength(32);
    expect(id).not.toContain("-");
  });
});
