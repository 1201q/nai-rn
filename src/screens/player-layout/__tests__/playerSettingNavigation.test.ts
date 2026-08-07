import {
  popPlayerPanelDetail,
  pushPlayerPanelDetail,
} from "../playerSettingNavigation";

describe("player setting detail navigation", () => {
  test("pushes nested resolution details and pops one level at a time", () => {
    const resolution = pushPlayerPanelDetail([], "resolution");
    const custom = pushPlayerPanelDetail(resolution, "resolutionCustom");

    expect(custom).toEqual(["resolution", "resolutionCustom"]);
    expect(popPlayerPanelDetail(custom)).toEqual(["resolution"]);
    expect(popPlayerPanelDetail(resolution)).toEqual([]);
  });

  test("does not duplicate the active detail", () => {
    const stack = ["model"] as const;
    const result = pushPlayerPanelDetail([...stack], "model");

    expect(result).toEqual(["model"]);
  });
});
