import { DEFAULT_NAI_RESOLUTION } from "../../constants/generation";
import {
  createRandomSeed,
  customResolutionListSignature,
  getCustomResolutionDraftState,
  getSeedDraftValue,
  sanitizeSeedText,
  shouldResetDeletedCustomResolution,
  snapResolutionDimension,
} from "../generationSettingDrafts";

describe("generation setting drafts", () => {
  test("sanitizes and validates seed input", () => {
    expect(sanitizeSeedText("12a34-56")).toBe("123456");
    expect(sanitizeSeedText("1234567890123")).toBe("1234567890");
    expect(getSeedDraftValue("")).toEqual({ parsed: 0, valid: true });
    expect(getSeedDraftValue("4294967295").valid).toBe(true);
    expect(getSeedDraftValue("4294967296").valid).toBe(false);
    expect(createRandomSeed(() => 0)).toBe(0);
  });

  test("snaps custom dimensions to 64 and rejects duplicate defaults", () => {
    expect(snapResolutionDimension("900")).toBe("896");
    expect(snapResolutionDimension("10")).toBe("64");

    const state = getCustomResolutionDraftState({
      widthText: "832",
      heightText: "1216",
      items: [],
      initialSignature: "",
    });
    expect(state).toMatchObject({
      dirty: true,
      inputInvalid: true,
      canSave: false,
    });
  });

  test("allows a valid custom resolution and detects list edits", () => {
    const items = [{ id: "one", width: 896, height: 1280 }];
    const signature = customResolutionListSignature(items);

    expect(
      getCustomResolutionDraftState({
        widthText: "960",
        heightText: "1280",
        items,
        initialSignature: signature,
      }),
    ).toMatchObject({ canSave: true, dirty: true, inputInvalid: false });
    expect(
      getCustomResolutionDraftState({
        widthText: "",
        heightText: "",
        items: [],
        initialSignature: signature,
      }),
    ).toMatchObject({ canSave: true, dirty: true });
  });

  test("resets a selected custom resolution only after it is removed", () => {
    const custom = { id: "one", width: 896, height: 1280 };
    expect(shouldResetDeletedCustomResolution(896, 1280, [custom])).toBe(
      false,
    );
    expect(shouldResetDeletedCustomResolution(896, 1280, [])).toBe(true);
    expect(
      shouldResetDeletedCustomResolution(
        DEFAULT_NAI_RESOLUTION.width,
        DEFAULT_NAI_RESOLUTION.height,
        [],
      ),
    ).toBe(false);
  });
});
