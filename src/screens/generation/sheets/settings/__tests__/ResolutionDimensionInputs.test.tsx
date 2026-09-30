import { useEffect } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import {
  resolutionFromDimensions,
  type NaiResolution,
} from "../../../../../constants/generation";
import {
  GenerationInputCommitProvider,
  useGenerationInputCommit,
} from "../../../../../context/GenerationInputCommitContext";
import { ResolutionDimensionInputs } from "../ResolutionDimensionInputs";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetTextInput: require("react-native").TextInput,
}));

const NORMAL_PORTRAIT = resolutionFromDimensions(832, 1216);

let commitPendingInput: () => void = () => {};

function CommitProbe() {
  const { commitPendingInput: commit } = useGenerationInputCommit();
  useEffect(() => {
    commitPendingInput = commit;
  }, [commit]);
  return null;
}

async function renderInputs({
  active = true,
  resolution = NORMAL_PORTRAIT,
  onChange = jest.fn(),
}: {
  active?: boolean;
  resolution?: NaiResolution;
  onChange?: jest.Mock;
} = {}) {
  const view = (props: { active: boolean; resolution: NaiResolution }) => (
    <GenerationInputCommitProvider>
      <CommitProbe />
      <ResolutionDimensionInputs {...props} onChange={onChange} />
    </GenerationInputCommitProvider>
  );
  const utils = await render(view({ active, resolution }));
  return {
    onChange,
    rerender: (props: { active?: boolean; resolution: NaiResolution }) =>
      utils.rerender(view({ active, ...props })),
  };
}

const width = () => screen.getByLabelText("Resolution width");
const height = () => screen.getByLabelText("Resolution height");

test("shows the current dimensions and strips non-digits while typing", async () => {
  const { onChange } = await renderInputs();
  expect(width().props.value).toBe("832");
  expect(height().props.value).toBe("1216");

  await act(async () => fireEvent.changeText(width(), "9a0-0"));
  expect(width().props.value).toBe("900");
  expect(onChange).not.toHaveBeenCalled();
});

test("snaps both dimensions to 64 on submit", async () => {
  const { onChange } = await renderInputs();
  await act(async () => fireEvent.changeText(width(), "1000"));
  await act(async () => fireEvent(width(), "submitEditing"));

  expect(onChange).toHaveBeenCalledWith(resolutionFromDimensions(1024, 1216));
  expect(width().props.value).toBe("1024");
});

test("commits on blur", async () => {
  const { onChange } = await renderInputs();
  await act(async () => fireEvent(height(), "focus"));
  await act(async () => fireEvent.changeText(height(), "30"));
  await act(async () => fireEvent(height(), "blur"));

  expect(onChange).toHaveBeenCalledWith(resolutionFromDimensions(832, 64));
  expect(height().props.value).toBe("64");
});

test("swaps width and height", async () => {
  const { onChange } = await renderInputs();
  await act(async () =>
    fireEvent.press(screen.getByLabelText("Width와 Height 바꾸기")),
  );

  expect(onChange).toHaveBeenCalledWith(resolutionFromDimensions(1216, 832));
  expect(width().props.value).toBe("1216");
  expect(height().props.value).toBe("832");
});

test("the pending input commit applies the focused text", async () => {
  const { onChange } = await renderInputs();
  await act(async () => fireEvent(width(), "focus"));
  await act(async () => fireEvent.changeText(width(), "700"));
  await act(async () => commitPendingInput());

  expect(onChange).toHaveBeenCalledWith(resolutionFromDimensions(704, 1216));
});

test("syncs external changes unless an input is focused", async () => {
  const { rerender } = await renderInputs();
  await act(async () =>
    rerender({ resolution: resolutionFromDimensions(1024, 1024) }),
  );
  expect(width().props.value).toBe("1024");

  await act(async () => fireEvent(width(), "focus"));
  await act(async () => fireEvent.changeText(width(), "900"));
  await act(async () =>
    rerender({ resolution: resolutionFromDimensions(1216, 832) }),
  );
  expect(width().props.value).toBe("900");
  expect(height().props.value).toBe("1024");
});

test("becoming inactive drops focus and syncs external changes", async () => {
  const { rerender, onChange } = await renderInputs();
  await act(async () => fireEvent(width(), "focus"));
  await act(async () => fireEvent.changeText(width(), "900"));
  await act(async () =>
    rerender({
      active: false,
      resolution: resolutionFromDimensions(1216, 832),
    }),
  );

  expect(width().props.value).toBe("1216");
  expect(height().props.value).toBe("832");
  await act(async () => commitPendingInput());
  expect(onChange).not.toHaveBeenCalled();
});
