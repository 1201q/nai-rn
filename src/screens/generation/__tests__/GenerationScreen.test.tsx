import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  type GenerationStartResult,
  useGenerationStore,
} from "../../../store/generationStore";
import { GenerationScreen } from "../GenerationScreen";

type MockGenerationState = {
  anlasBalance: null;
  prompt: string;
  isLoading: boolean;
  batchCount: number;
  queueTotal: number;
  queueIndex: number;
  generateImage: jest.Mock<Promise<GenerationStartResult>, []>;
  requestQueueCancel: jest.Mock<void, []>;
};

jest.mock("../../../store/generationStore", () => {
  const { create } = require("zustand") as typeof import("zustand");

  return {
    selectOverallPercent: () => 0,
    useGenerationStore: create<MockGenerationState>(() => ({
      anlasBalance: null,
      prompt: "prompt",
      isLoading: false,
      batchCount: 1,
      queueTotal: 0,
      queueIndex: 0,
      generateImage: jest.fn(),
      requestQueueCancel: jest.fn(),
    })),
  };
});

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("@gorhom/portal", () => ({
  PortalHost: () => null,
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ navigate: jest.fn() }),
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native") as typeof import("react-native");

  return {
    __esModule: true,
    default: { View },
    cancelAnimation: jest.fn(),
    Easing: {
      linear: jest.fn(),
      bezier: jest.fn(() => jest.fn()),
    },
    useAnimatedStyle: (factory: () => object) => factory(),
    useSharedValue: <T,>(value: T) => ({ value }),
    withSpring: <T,>(value: T) => value,
    withTiming: <T,>(value: T) => value,
  };
});

jest.mock("react-native-keyboard-controller", () => {
  const React = require("react") as typeof import("react");
  const { View } = require("react-native") as typeof import("react-native");

  return {
    KeyboardStickyView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock("../../../components/common/Buttons", () => {
  const React = require("react") as typeof import("react");
  const { Pressable } = require("react-native") as typeof import("react-native");

  return {
    IconButton: ({
      label,
      onPress,
    }: {
      label: string;
      onPress: () => void;
    }) =>
      React.createElement(Pressable, {
        accessibilityLabel: label,
        onPress,
      }),
  };
});

jest.mock("../../../components/forms/SheetSelect", () => ({
  SHEET_SELECT_PORTAL_HOST: "sheet-select",
}));

jest.mock("../../../components/generation/SuggestionBar", () => ({
  SuggestionBar: () => null,
}));

jest.mock("../../../context/SuggestionBarContext", () => ({
  SuggestionBarProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock("../../../native/predictiveBack", () => ({
  usePredictiveBackHandler: () => {},
}));

jest.mock("../GenerationCanvas", () => ({
  GenerationCanvas: () => null,
}));

jest.mock("../GenerationSheetScaffold", () => {
  const React = require("react") as typeof import("react");
  const { Pressable, Text, View } =
    require("react-native") as typeof import("react-native");

  return {
    PromptSheetHost: ({
      promptStage,
      onPromptStageChange,
    }: {
      promptStage: "collapsed" | "half" | "full";
      onPromptStageChange: (stage: "collapsed" | "half" | "full") => void;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(
          Text,
          { testID: "prompt-stage" },
          promptStage,
        ),
        React.createElement(Pressable, {
          accessibilityLabel: "Prompt 테스트 열기",
          onPress: () => onPromptStageChange("full"),
        }),
      ),
    UtilitySheetHost: ({ sheet }: { sheet: "settings" | "history" | null }) =>
      React.createElement(
        Text,
        { testID: "utility-sheet" },
        sheet ?? "closed",
      ),
  };
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

const initialState = useGenerationStore.getInitialState();
const mockInsets = jest.mocked(useSafeAreaInsets);
const mockGenerateImage = initialState.generateImage as jest.Mock<
  Promise<GenerationStartResult>,
  []
>;

describe("GenerationScreen generation acceptance", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsets.mockReturnValue({ top: 0, right: 0, bottom: 0, left: 0 });
    useGenerationStore.setState(initialState, true);
  });

  test.each([0, 24, 34])("reserves %i bottom inset for the action bar and canvas", async (bottom) => {
    mockInsets.mockReturnValue({ top: 59, right: 0, bottom, left: 0 });
    const screen = await render(<GenerationScreen />);

    expect(screen.getByTestId("generation-action-bar")).toHaveStyle({
      height: 72 + bottom,
      paddingBottom: bottom,
    });
    expect(screen.getByTestId("generation-screen")).toHaveStyle({
      paddingTop: 71,
      paddingBottom: 128 + bottom,
    });
  });

  test("updates the action bar after the bottom inset changes", async () => {
    const screen = await render(<GenerationScreen />);
    mockInsets.mockReturnValue({ top: 59, right: 0, bottom: 34, left: 0 });
    await screen.rerender(<GenerationScreen />);

    expect(screen.getByTestId("generation-action-bar")).toHaveStyle({
      height: 106,
      paddingBottom: 34,
    });
    expect(screen.getByTestId("generation-screen")).toHaveStyle({ paddingBottom: 162 });
  });

  test("keeps Prompt open when generation validation is rejected", async () => {
    mockGenerateImage.mockResolvedValue({
      status: "rejected",
      reason: "validation",
    });
    const screen = await render(<GenerationScreen />);

    await fireEvent.press(screen.getByLabelText("Prompt 테스트 열기"));
    await fireEvent.press(screen.getByLabelText("생성"));

    await waitFor(() => {
      expect(mockGenerateImage).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("prompt-stage").props.children).toBe("full");
    });
    await screen.unmount();
  });

  test("keeps Settings open when generation preparation fails", async () => {
    mockGenerateImage.mockResolvedValue({
      status: "rejected",
      reason: "preparation",
    });
    const screen = await render(<GenerationScreen />);

    await fireEvent.press(screen.getByLabelText("Settings 열기"));
    await fireEvent.press(screen.getByLabelText("생성"));

    await waitFor(() => {
      expect(mockGenerateImage).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("utility-sheet").props.children).toBe(
        "settings",
      );
    });
    await screen.unmount();
  });

  test("closes open sheets only after generation is accepted", async () => {
    const result = createDeferred<GenerationStartResult>();
    mockGenerateImage.mockReturnValue(result.promise);
    const screen = await render(<GenerationScreen />);

    await fireEvent.press(screen.getByLabelText("Prompt 테스트 열기"));
    await fireEvent.press(screen.getByLabelText("Settings 열기"));
    await fireEvent.press(screen.getByLabelText("생성"));

    expect(screen.getByTestId("prompt-stage").props.children).toBe("full");
    expect(screen.getByTestId("utility-sheet").props.children).toBe(
      "settings",
    );

    await act(async () => {
      result.resolve({ status: "started" });
      await result.promise;
    });

    await waitFor(() => {
      expect(screen.getByTestId("prompt-stage").props.children).toBe(
        "collapsed",
      );
      expect(screen.getByTestId("utility-sheet").props.children).toBe(
        "closed",
      );
    });
    await screen.unmount();
  });
});
