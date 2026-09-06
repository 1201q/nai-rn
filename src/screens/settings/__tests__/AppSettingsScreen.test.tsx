import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import {
  isGenerationPerformanceRecording,
  stopGenerationPerformance,
} from "../../../lib/generationPerformance";

import {
  type AnlasRefreshResult,
  useGenerationStore,
} from "../../../store/generationStore";
import { AppSettingsScreen } from "../AppSettingsScreen";

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));

type MockSettingsState = {
  storedToken: string | null;
  saveToken: jest.Mock<Promise<void>, [string]>;
  refreshAnlas: jest.Mock<Promise<AnlasRefreshResult>, []>;
};

jest.mock("../../../store/generationStore", () => {
  const { create } = require("zustand") as typeof import("zustand");

  return {
    useGenerationStore: create<MockSettingsState>(() => ({
      storedToken: null,
      saveToken: jest.fn(),
      refreshAnlas: jest.fn(),
    })),
  };
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: jest.fn() }),
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("../../../components/common/Buttons", () => {
  const React = require("react") as typeof import("react");
  const { Pressable, Text } =
    require("react-native") as typeof import("react-native");

  return {
    PrimaryButton: ({
      label,
      onPress,
    }: {
      label: string;
      onPress: () => void;
    }) =>
      React.createElement(
        Pressable,
        { accessibilityLabel: label, onPress },
        React.createElement(Text, null, label),
      ),
  };
});

jest.mock("../../../components/common/DetailScrollHeader", () => ({
  DETAIL_FIXED_HEADER_CONTENT_OFFSET: 0,
  DetailHeaderOverlay: () => null,
}));

const initialState = useGenerationStore.getInitialState();
const mockSaveToken = initialState.saveToken as MockSettingsState["saveToken"];
const mockRefreshAnlas =
  initialState.refreshAnlas as MockSettingsState["refreshAnlas"];

test("keeps recording across settings unmount and exports a stopped report without the token", async () => {
  try {
    useGenerationStore.setState({ storedToken: "private-token-for-test" });
    const first = await render(<AppSettingsScreen />);
    await fireEvent.press(first.getByLabelText("성능 측정 시작"));
    await first.unmount();
    expect(isGenerationPerformanceRecording()).toBe(true);

    const second = await render(<AppSettingsScreen />);
    await fireEvent.press(second.getByLabelText("성능 측정 종료"));
    expect(isGenerationPerformanceRecording()).toBe(false);
    await fireEvent.press(second.getByLabelText("측정 결과 JSON 복사"));
    await waitFor(() => expect(Clipboard.setStringAsync).toHaveBeenCalled());
    const json = jest.mocked(Clipboard.setStringAsync).mock.calls.at(-1)![0];
    expect(JSON.parse(json)).toHaveProperty("jsLagForeground");
    expect(json).not.toContain("private-token-for-test");
  } finally {
    stopGenerationPerformance();
    await act(() => useGenerationStore.setState(initialState, true));
  }
});

describe("AppSettingsScreen token verification feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useGenerationStore.setState(initialState, true);
    mockSaveToken.mockResolvedValue(undefined);
  });

  async function saveTokenWithResult(result: AnlasRefreshResult) {
    mockRefreshAnlas.mockResolvedValue(result);
    const screen = await render(<AppSettingsScreen />);

    await fireEvent.changeText(
      screen.getByLabelText("NovelAI API 토큰"),
      " new-token ",
    );
    await fireEvent.press(screen.getByLabelText("Save Token"));

    await waitFor(() => {
      expect(mockSaveToken).toHaveBeenCalledWith("new-token");
      expect(mockRefreshAnlas).toHaveBeenCalledTimes(1);
    });

    return screen;
  }

  test("shows verified feedback after a successful balance refresh", async () => {
    const screen = await saveTokenWithResult({
      status: "success",
      balance: { fixed: 20, purchased: 7, total: 27 },
    });

    expect(screen.getByText("API 토큰을 저장하고 확인했습니다.")).toBeTruthy();
    await screen.unmount();
  });

  test("shows invalid-token feedback for an authentication failure", async () => {
    const screen = await saveTokenWithResult({ status: "invalid-token" });

    expect(screen.getByText("토큰은 저장했지만 유효하지 않습니다.")).toBeTruthy();
    await screen.unmount();
  });

  test("shows unavailable feedback for a network failure", async () => {
    const screen = await saveTokenWithResult({ status: "unavailable" });

    expect(
      screen.getByText(
        "토큰은 저장했지만 현재 유효성을 확인하지 못했습니다.",
      ),
    ).toBeTruthy();
    await screen.unmount();
  });
});
