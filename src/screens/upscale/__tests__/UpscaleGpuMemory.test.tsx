import { act, render } from "@testing-library/react-native";

import {
  imageUpscaler,
  type UpscaleGpuInfo,
} from "../../../../modules/image-upscaler";
import { UpscaleGpuMemory } from "../UpscaleGpuMemory";

jest.mock("../../../components/forms/HelpButton", () => ({
  HelpButton: () => null,
}));

jest.mock("../../../../modules/image-upscaler", () => ({
  imageUpscaler: { getGpuInfo: jest.fn() },
}));

beforeEach(() => {
  jest.resetAllMocks();
});

test("queries GPU budget only while active and refreshes when reopened", async () => {
  jest
    .mocked(imageUpscaler!.getGpuInfo)
    .mockResolvedValue({ available: true, heapBudgetMiB: 512 });
  const view = await render(<UpscaleGpuMemory active={false} />);
  expect(imageUpscaler!.getGpuInfo).not.toHaveBeenCalled();
  await view.rerender(<UpscaleGpuMemory active />);
  expect(await view.findByText("512 MiB")).toBeTruthy();
  await view.rerender(<UpscaleGpuMemory active={false} />);
  jest
    .mocked(imageUpscaler!.getGpuInfo)
    .mockResolvedValue({ available: true, heapBudgetMiB: 256 });
  await view.rerender(<UpscaleGpuMemory active />);
  expect(await view.findByText("256 MiB")).toBeTruthy();
});

test("shows CPU fallback when there is no Vulkan GPU", async () => {
  jest
    .mocked(imageUpscaler!.getGpuInfo)
    .mockResolvedValue({ available: false, heapBudgetMiB: null });
  const view = await render(<UpscaleGpuMemory active />);
  expect(await view.findByText("GPU 없음 · CPU 사용")).toBeTruthy();
});

test("handles query failure and retries on the next activation", async () => {
  jest
    .mocked(imageUpscaler!.getGpuInfo)
    .mockRejectedValueOnce(new Error("GPU query failed"));
  const view = await render(<UpscaleGpuMemory active />);
  expect(await view.findByText("조회할 수 없음")).toBeTruthy();
  await view.rerender(<UpscaleGpuMemory active={false} />);
  jest
    .mocked(imageUpscaler!.getGpuInfo)
    .mockResolvedValue({ available: true, heapBudgetMiB: 128 });
  await view.rerender(<UpscaleGpuMemory active />);
  expect(await view.findByText("128 MiB")).toBeTruthy();
});

test("ignores a stale query after the panel is closed and reopened", async () => {
  let finish!: (info: UpscaleGpuInfo) => void;
  jest.mocked(imageUpscaler!.getGpuInfo).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = await render(<UpscaleGpuMemory active />);
  await view.rerender(<UpscaleGpuMemory active={false} />);
  jest
    .mocked(imageUpscaler!.getGpuInfo)
    .mockResolvedValue({ available: true, heapBudgetMiB: 256 });
  await view.rerender(<UpscaleGpuMemory active />);
  expect(await view.findByText("256 MiB")).toBeTruthy();
  await act(async () => {
    finish({ available: true, heapBudgetMiB: 512 });
  });
  expect(view.queryByText("512 MiB")).toBeNull();
  expect(view.getByText("256 MiB")).toBeTruthy();
});
