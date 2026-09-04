import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { BackHandler, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  type GenerationStartResult,
  useGenerationStore,
} from "../../../store/generationStore";
import { GenerationScreen } from "../GenerationScreen";

type MockGenerationState = {
  anlasBalance: null;
  prompt: string;
  currentGeneration: null;
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
      currentGeneration: null,
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
  Portal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("react-native/Libraries/Components/Pressable/Pressable", () => {
  const React = require("react") as typeof import("react");
  const { default: Pressable } = jest.requireActual(
    "react-native/Libraries/Components/Pressable/Pressable",
  );
  return {
    __esModule: true,
    default: React.forwardRef(function MeasuredPressable(props, ref) {
      React.useImperativeHandle(ref, () => ({
        measureInWindow: (
          callback: (x: number, y: number, width: number, height: number) => void,
        ) => callback(24, 100, 200, 46),
      }));
      return React.createElement(Pressable, props);
    }),
  };
});

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
    Extrapolation: { CLAMP: "clamp" },
    interpolate: () => 1,
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

jest.mock("../../../components/generation/SuggestionBar", () => ({
  SuggestionBar: () => null,
}));

jest.mock("../../../context/SuggestionBarContext", () => ({
  SuggestionBarProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock("../../../native/predictiveBack", () => ({
  PREDICTIVE_BACK_SUPPORTED: false,
  usePredictiveBackHandler: () => {},
}));

jest.mock("../GenerationCanvas", () => ({
  GenerationCanvas: ({
    onOpenMetadata,
  }: {
    onOpenMetadata: () => void;
  }) => {
    const React = require("react") as typeof import("react");
    const { Pressable } = require("react-native") as typeof import("react-native");
    return React.createElement(Pressable, {
      accessibilityLabel: "Metadata 테스트 열기",
      onPress: onOpenMetadata,
    });
  },
}));

jest.mock("../GenerationSheetScaffold", () => {
  const React = require("react") as typeof import("react");
  const { Pressable, Text, View } =
    require("react-native") as typeof import("react-native");
  const { SheetSelect } = require("../../../components/forms/SheetSelect") as
    typeof import("../../../components/forms/SheetSelect");

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
    UtilitySheetHost: function MockUtilitySheet({
      sheet,
    }: {
      sheet: "settings" | "history" | "metadata" | null;
    }) {
      const [open, setOpen] = React.useState(false);
      return React.createElement(
        View,
        null,
        React.createElement(
          Text,
          { testID: "utility-sheet" },
          sheet ?? "closed",
        ),
        sheet === "settings"
          ? React.createElement(SheetSelect, {
              label: "Model",
              value: "Model A",
              options: ["Model A", "Model B"],
              onChange: jest.fn(),
              open,
              onOpenChange: (next: boolean) => setOpen(next),
            })
          : null,
      );
    },
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

  test("hardware back closes Select, Settings, then Prompt without closing two layers", async () => {
    const originalPlatform = Platform.OS;
    Platform.OS = "android";
    const listeners: Array<() => boolean | null | undefined> = [];
    const subscriptionSpy = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, handler) => {
        const listener = handler as () => boolean | null | undefined;
        listeners.push(listener);
        return {
          remove: () => {
            const index = listeners.indexOf(listener);
            if (index !== -1) listeners.splice(index, 1);
          },
        };
      });
    const pressBack = async () => {
      let consumed = false;
      await act(() => {
        for (const listener of [...listeners].reverse()) {
          if (listener()) {
            consumed = true;
            break;
          }
        }
      });
      return consumed;
    };

    try {
      const screen = await render(<GenerationScreen />);
      await fireEvent.press(screen.getByLabelText("Prompt 테스트 열기"));
      await fireEvent.press(screen.getByLabelText("Settings 열기"));
      await fireEvent.press(screen.getByLabelText("Model 선택"));
      await act(() => {
        useGenerationStore.setState({ prompt: "updated prompt" });
      });

      expect(await pressBack()).toBe(true);
      expect(screen.queryByLabelText("Model B")).toBeNull();
      expect(screen.getByTestId("utility-sheet").props.children).toBe("settings");
      expect(screen.getByTestId("prompt-stage").props.children).toBe("full");

      expect(await pressBack()).toBe(true);
      expect(screen.getByTestId("utility-sheet").props.children).toBe("closed");
      expect(screen.getByTestId("prompt-stage").props.children).toBe("full");
      expect(await pressBack()).toBe(true);
      expect(screen.getByTestId("prompt-stage").props.children).toBe("half");
      expect(await pressBack()).toBe(true);
      expect(screen.getByTestId("prompt-stage").props.children).toBe("collapsed");
      expect(await pressBack()).toBe(false);
      await screen.unmount();
      expect(listeners).toHaveLength(0);
    } finally {
      subscriptionSpy.mockRestore();
      Platform.OS = originalPlatform;
    }
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

  test("opens Metadata in the shared utility sheet slot", async () => {
    const screen = await render(<GenerationScreen />);

    await fireEvent.press(screen.getByLabelText("Metadata 테스트 열기"));
    expect(screen.getByTestId("utility-sheet").props.children).toBe("metadata");

    await fireEvent.press(screen.getByLabelText("Settings 열기"));
    expect(screen.getByTestId("utility-sheet").props.children).toBe("settings");
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
