import { fireEvent, render, waitFor } from "@testing-library/react-native";

import {
  type AnlasRefreshResult,
  useGenerationStore,
} from "../../../store/generationStore";
import { AppSettingsScreen } from "../AppSettingsScreen";

const mockSliderControlsProps = jest.fn();
const mockSelectProps = jest.fn();

type MockSettingsState = {
  batchCount: number;
  setBatchCount: jest.Mock<void, [number]>;
  imageFormat: "png" | "webp";
  setImageFormat: jest.Mock<void, ["png" | "webp"]>;
  storedToken: string | null;
  anlasBalance:
    Extract<AnlasRefreshResult, { status: "success" }>["balance"] | null;
  saveToken: jest.Mock<Promise<void>, [string]>;
  refreshAnlas: jest.Mock<Promise<AnlasRefreshResult>, []>;
};

jest.mock("../../../store/generationStore", () => {
  const { create } = require("zustand") as typeof import("zustand");

  return {
    useGenerationStore: create<MockSettingsState>(() => ({
      batchCount: 1,
      setBatchCount: jest.fn(),
      imageFormat: "png",
      setImageFormat: jest.fn(),
      storedToken: null,
      anlasBalance: null,
      saveToken: jest.fn(),
      refreshAnlas: jest.fn(),
    })),
  };
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../../../components/forms/SheetSliderControls", () => ({
  SheetSliderControls: (props: unknown) => {
    mockSliderControlsProps(props);
    return null;
  },
}));

jest.mock("../../../components/forms/SheetSelect", () => ({
  SheetSelect: (props: unknown) => {
    mockSelectProps(props);
    return null;
  },
}));

jest.mock("@gorhom/portal", () => ({
  PortalHost: () => null,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../../../components/common/DetailScrollHeader", () => ({
  DETAIL_FIXED_HEADER_CONTENT_OFFSET: 0,
  DetailHeaderOverlay: () => null,
}));

const initialState = useGenerationStore.getInitialState();
const mockSaveToken = initialState.saveToken as MockSettingsState["saveToken"];
const mockRefreshAnlas =
  initialState.refreshAnlas as MockSettingsState["refreshAnlas"];

describe("AppSettingsScreen token verification feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGenerationStore.setState(initialState, true);
    mockSaveToken.mockResolvedValue(undefined);
  });

  test("edits Batch Count inline with a slider, without legacy page links", async () => {
    const screen = await render(<AppSettingsScreen />);

    expect(screen.queryByText("LEGACY PAGES")).toBeNull();
    expect(screen.queryByText("Settings / Prompt")).toBeNull();
    expect(screen.queryByText("History")).toBeNull();
    expect(mockSliderControlsProps).toHaveBeenLastCalledWith({
      inSheet: false,
      label: "Batch Count",
      value: 1,
      min: 1,
      max: 100,
      step: 1,
      precision: 0,
      onChange: initialState.setBatchCount,
      header: expect.anything(),
    });
    await screen.unmount();
  });

  test("selects the image format, with PNG as the default", async () => {
    const screen = await render(<AppSettingsScreen />);

    const select = mockSelectProps.mock.lastCall[0];
    expect(select.value).toBe("PNG");
    expect(select.options).toEqual(["PNG", "WebP"]);
    select.onChange("WebP");
    expect(initialState.setImageFormat).toHaveBeenCalledWith("webp");
    await screen.unmount();
  });

  test("shows tier, Anlas and a masked token once a token is stored", async () => {
    useGenerationStore.setState({
      storedToken: "pst-abcdefghijkl1234",
      anlasBalance: {
        fixed: 10000,
        purchased: 2480,
        total: 12480,
        tier: 3,
        expiresAt: 0,
      },
    });
    const screen = await render(<AppSettingsScreen />);

    expect(screen.getByText("OPUS")).toBeTruthy();
    expect(screen.getByText("12,480")).toBeTruthy();
    expect(screen.getByText("pst-••••••••1234")).toBeTruthy();
    expect(screen.queryByLabelText("NovelAI API 토큰")).toBeNull();

    await fireEvent.press(screen.getByLabelText("토큰 변경"));
    expect(screen.getByLabelText("NovelAI API 토큰")).toBeTruthy();
    await screen.unmount();
  });

  async function saveTokenWithResult(result: AnlasRefreshResult) {
    mockRefreshAnlas.mockResolvedValue(result);
    const screen = await render(<AppSettingsScreen />);

    await fireEvent.changeText(
      screen.getByLabelText("NovelAI API 토큰"),
      " new-token ",
    );
    await fireEvent.press(screen.getByLabelText("토큰 저장"));

    await waitFor(() => {
      expect(mockSaveToken).toHaveBeenCalledWith("new-token");
      expect(mockRefreshAnlas).toHaveBeenCalledTimes(1);
    });

    return screen;
  }

  test("shows verified feedback after a successful balance refresh", async () => {
    const screen = await saveTokenWithResult({
      status: "success",
      balance: { fixed: 20, purchased: 7, total: 27, tier: 1, expiresAt: 0 },
    });

    expect(screen.getByText("API 토큰을 저장하고 확인했습니다.")).toBeTruthy();
    await screen.unmount();
  });

  test("shows invalid-token feedback for an authentication failure", async () => {
    const screen = await saveTokenWithResult({ status: "invalid-token" });

    expect(
      screen.getByText("토큰은 저장했지만 유효하지 않습니다."),
    ).toBeTruthy();
    await screen.unmount();
  });

  test("shows unavailable feedback for a network failure", async () => {
    const screen = await saveTokenWithResult({ status: "unavailable" });

    expect(
      screen.getByText("토큰은 저장했지만 현재 유효성을 확인하지 못했습니다."),
    ).toBeTruthy();
    await screen.unmount();
  });
});
