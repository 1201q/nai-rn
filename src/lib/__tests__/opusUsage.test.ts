import { formatUsageMessage, formatUsageRecovery } from "../opusUsage";

test.each([
  [30_000, "1분 이내"],
  [15 * 60_000, "약 15분"],
  [2 * 3_600_000, "약 2시간"],
  [7_888_000, "약 2시간 12분"],
])("formats %s ms as %s", (remainingMs, expected) => {
  expect(formatUsageRecovery(remainingMs)).toBe(expected);
});

test("omits the recovery time when full or unknown", () => {
  expect(formatUsageMessage(100, 5_000, 0)).toBe("Opus 사용량 100% 남음");
  expect(formatUsageMessage(42, undefined, 0)).toBe("Opus 사용량 42% 남음");
  expect(formatUsageMessage(0, 15 * 60_000, 0)).toBe(
    "Opus 사용량 0% 남음 · 다음 1% 회복까지 약 15분",
  );
});
