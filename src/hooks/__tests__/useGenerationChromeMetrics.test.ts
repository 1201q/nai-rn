import { renderHook } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGenerationChromeMetrics } from "../useGenerationChromeMetrics";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(),
}));

const mockInsets = jest.mocked(useSafeAreaInsets);
// 핸들 17 + 헤더 44, 헤더 구분선 자리는 액션바 border가 덮는다.
const PREVIEW_HEIGHT = 61 - StyleSheet.hairlineWidth;

describe("generation chrome metrics", () => {
  test.each([
    { top: 0, bottom: 0, promptFullTop: 56, utilitySheetTop: 56 },
    { top: 24, bottom: 24, promptFullTop: 56, utilitySheetTop: 56 },
    { top: 59, bottom: 34, promptFullTop: 71, utilitySheetTop: 71 },
  ])("reserves safe area once for $top/$bottom insets", async (insets) => {
    mockInsets.mockReturnValue({ ...insets, left: 0, right: 0 });
    const hook = await renderHook(useGenerationChromeMetrics);

    expect(hook.result.current).toEqual({
      topInset: insets.top,
      bottomInset: insets.bottom,
      actionBarHeight: 72 + insets.bottom,
      promptCollapsedHeight: 72 + PREVIEW_HEIGHT + insets.bottom,
      sheetContentPaddingBottom: 200 + insets.bottom,
      promptFullTop: insets.promptFullTop,
      utilitySheetTop: insets.utilitySheetTop,
    });
    expect(
      hook.result.current.promptCollapsedHeight -
        hook.result.current.actionBarHeight,
    ).toBe(PREVIEW_HEIGHT);
    expect(hook.result.current.promptFullTop).toBe(
      hook.result.current.utilitySheetTop,
    );
  });

  test("updates all metrics when the safe area changes", async () => {
    mockInsets.mockReturnValue({ top: 59, bottom: 34, left: 0, right: 0 });
    const hook = await renderHook(useGenerationChromeMetrics);

    mockInsets.mockReturnValue({ top: 0, bottom: 0, left: 0, right: 0 });
    await hook.rerender(undefined);

    expect(hook.result.current).toMatchObject({
      actionBarHeight: 72,
      promptCollapsedHeight: 72 + PREVIEW_HEIGHT,
      sheetContentPaddingBottom: 200,
      promptFullTop: 56,
      utilitySheetTop: 56,
    });
  });
});
