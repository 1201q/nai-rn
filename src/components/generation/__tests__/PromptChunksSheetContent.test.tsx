import { act, fireEvent, render } from "@testing-library/react-native";
import { Alert } from "react-native";

import {
  clearPromptInsertTarget,
  rememberPromptInsertTarget,
} from "../../../lib/promptInsertTarget";
import { useGenerationStore } from "../../../store/generationStore";
import { usePromptChunkStore } from "../../../store/promptChunkStore";
import { PromptChunksSheetContent } from "../PromptChunksSheetContent";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("sonner-native", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock("../../../lib/storage", () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
}));
jest.mock("../../../store/generationStore", () => {
  const { create } = jest.requireActual("zustand");
  return {
    useGenerationStore: create(() => ({
      prompt: "",
      negativePrompt: "",
      characterPrompts: [],
    })),
  };
});
jest.mock("../../../hooks/useGenerationChromeMetrics", () => ({
  useGenerationChromeMetrics: () => ({ sheetContentPaddingBottom: 0 }),
}));
jest.mock("../BottomSheetKeyboardAwareScrollView", () => {
  const { View } = jest.requireActual("react-native");
  return {
    BottomSheetKeyboardAwareScrollView: ({
      children,
    }: {
      children: React.ReactNode;
    }) => <View>{children}</View>,
  };
});

const { toast } = jest.requireMock("sonner-native") as {
  toast: { success: jest.Mock; error: jest.Mock; info: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
  usePromptChunkStore.setState({ chunks: [], categories: [] });
  useGenerationStore.setState({ prompt: "" });
  clearPromptInsertTarget();
});

it("creates a chunk through the form and lists it", async () => {
  const screen = await render(<PromptChunksSheetContent active />);
  expect(screen.getByText(/No custom prompt chunks yet/)).toBeTruthy();

  await fireEvent.press(screen.getByLabelText("Chunk 추가"));
  await fireEvent.press(screen.getByText("Save"));
  expect(toast.error).toHaveBeenCalledWith("이름을 입력하세요.");

  await fireEvent.changeText(screen.getByLabelText("Chunk 이름"), "Style");
  await fireEvent.changeText(screen.getByLabelText("Chunk 내용"), "oil,");
  await fireEvent.press(screen.getByText("Save"));

  expect(usePromptChunkStore.getState().chunks).toMatchObject([
    { name: "Style", content: "oil,", categoryId: null },
  ]);
  expect(screen.getByLabelText("Style 편집")).toBeTruthy();
});

it("shows categories with their chunks and collapses them", async () => {
  usePromptChunkStore.setState({
    categories: [
      { id: "cat", name: "배경", color: "#6B7280", collapsed: false },
      { id: "empty", name: "빈 것", color: "#6B7280", collapsed: false },
    ],
    chunks: [
      {
        id: "1",
        name: "숲",
        content: "forest",
        color: "#6B7280",
        categoryId: "cat",
      },
    ],
  });
  const screen = await render(<PromptChunksSheetContent active />);

  expect(screen.getByLabelText("숲 편집")).toBeTruthy();
  expect(screen.getByText("Empty category")).toBeTruthy();

  await fireEvent.press(screen.getByLabelText("배경 카테고리"));
  expect(screen.queryByLabelText("숲 편집")).toBeNull();
});

it("deletes everything only after confirmation", async () => {
  usePromptChunkStore.setState({
    categories: [],
    chunks: [
      { id: "1", name: "A", content: "a", color: "#6B7280", categoryId: null },
    ],
  });
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const screen = await render(<PromptChunksSheetContent active />);

  await fireEvent.press(screen.getByText("Delete All"));
  expect(usePromptChunkStore.getState().chunks).toHaveLength(1);

  const buttons = alert.mock.calls[0][2]!;
  await act(async () => {
    buttons.find((button) => button.style === "destructive")!.onPress!();
  });
  expect(usePromptChunkStore.getState().chunks).toEqual([]);
});

it("inserts a tapped chunk at the remembered caret and opens edit from the pencil", async () => {
  usePromptChunkStore.setState({
    categories: [],
    chunks: [
      { id: "1", name: "A", content: "a", color: "#6B7280", categoryId: null },
    ],
  });
  useGenerationStore.setState({ prompt: "1girl, " });
  const screen = await render(<PromptChunksSheetContent active />);

  await fireEvent.press(screen.getByLabelText("A 삽입"));
  expect(toast.info).toHaveBeenCalledTimes(1);
  expect(useGenerationStore.getState().prompt).toBe("1girl, ");

  rememberPromptInsertTarget({ scope: "base", channel: "positive" }, 7);
  await fireEvent.press(screen.getByLabelText("A 삽입"));
  expect(useGenerationStore.getState().prompt).toBe("1girl, !macro:A!");

  await fireEvent.press(screen.getByLabelText("A 편집"));
  expect(screen.getByLabelText("Chunk 이름").props.value).toBe("A");
});
