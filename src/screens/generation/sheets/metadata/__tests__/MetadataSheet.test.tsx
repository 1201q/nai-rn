import { act, fireEvent, render } from "@testing-library/react-native";
import { BackHandler, Platform } from "react-native";

import type { GenerationRecord } from "../../../../../lib/generationHistory";
import { MetadataSheet } from "../MetadataSheet";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("../../../../../native/predictiveBack", () => ({
  PREDICTIVE_BACK_SUPPORTED: false,
  usePredictiveBackHandler: jest.fn(),
}));
jest.mock("../../SheetLayers", () => {
  const React = require("react") as typeof import("react");
  const { Pressable } =
    require("react-native") as typeof import("react-native");
  return {
    PressableSurface: (props: import("react-native").PressableProps) =>
      React.createElement(Pressable, { accessibilityRole: "button", ...props }),
  };
});
jest.mock("../MetadataSheetContent", () => {
  const React = require("react") as typeof import("react");
  const { Pressable, Text } =
    require("react-native") as typeof import("react-native");
  return {
    MetadataSheetContent: ({ onImport }: { onImport: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: "button", onPress: onImport },
        React.createElement(Text, null, "metadata body"),
      ),
  };
});
jest.mock("../MetadataImportContent", () => {
  const React = require("react") as typeof import("react");
  const { Pressable, Text } =
    require("react-native") as typeof import("react-native");
  return {
    MetadataImportContent: ({ onImported }: { onImported: () => void }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: "button", onPress: onImported },
        React.createElement(Text, null, "import body"),
      ),
  };
});

const generation = { id: "generation-1" } as GenerationRecord;
const originalPlatform = Platform.OS;

describe("MetadataSheet", () => {
  afterEach(() => {
    Platform.OS = originalPlatform;
    jest.restoreAllMocks();
  });

  test("opens Import from Metadata and returns with the back button", async () => {
    const onClose = jest.fn();
    const screen = await render(
      <MetadataSheet generation={generation} onClose={onClose} />,
    );

    expect(screen.getByText("Metadata")).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByLabelText("Metadata로 돌아가기")).toBeNull();

    await fireEvent.press(screen.getByText("metadata body"));
    expect(screen.getByText("Import")).toBeTruthy();
    expect(screen.getByText("import body")).toBeTruthy();
    expect(screen.queryByText("metadata body")).toBeNull();

    await fireEvent.press(screen.getByLabelText("Metadata로 돌아가기"));
    expect(screen.getByText("metadata body")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("closes the sheet from the close button and after importing", async () => {
    const onClose = jest.fn();
    const screen = await render(
      <MetadataSheet generation={generation} onClose={onClose} />,
    );

    await fireEvent.press(screen.getByLabelText("Metadata 닫기"));
    expect(onClose).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByText("metadata body"));
    await fireEvent.press(screen.getByText("import body"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test("returns to Metadata on hardware back only while importing", async () => {
    Platform.OS = "android";
    const listeners: Parameters<typeof BackHandler.addEventListener>[1][] = [];
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, listener) => {
        listeners.push(listener);
        return {
          remove: () => {
            listeners.splice(listeners.indexOf(listener), 1);
          },
        };
      });
    const screen = await render(
      <MetadataSheet generation={generation} onClose={jest.fn()} />,
    );

    expect(listeners).toHaveLength(0);
    await fireEvent.press(screen.getByText("metadata body"));
    expect(listeners).toHaveLength(1);

    await act(() => {
      listeners[0]({} as never);
    });
    expect(screen.getByText("metadata body")).toBeTruthy();
    expect(listeners).toHaveLength(0);
  });
});
