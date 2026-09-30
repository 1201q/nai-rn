import { extractImageMetadata } from "../imageMetadata";
import { extractPngTextMetadata } from "../pngMetadata";
import { extractStealthMetadata } from "../stealthMetadata";

jest.mock("../pngMetadata", () => ({ extractPngTextMetadata: jest.fn() }));
jest.mock("../stealthMetadata", () => ({ extractStealthMetadata: jest.fn() }));

const bytes = new Uint8Array([1, 2, 3]);

beforeEach(() => {
  jest.mocked(extractPngTextMetadata).mockReturnValue({});
  jest.mocked(extractStealthMetadata).mockReturnValue({});
});

test("prefers PNG text metadata", () => {
  jest.mocked(extractPngTextMetadata).mockReturnValue({ Comment: "{}" });

  expect(extractImageMetadata(bytes)).toEqual({ Comment: "{}" });
  expect(extractStealthMetadata).not.toHaveBeenCalled();
});

test("falls back to stealth metadata when text values are blank", () => {
  jest.mocked(extractPngTextMetadata).mockReturnValue({ Comment: "  " });
  jest.mocked(extractStealthMetadata).mockReturnValue({ Description: "p" });

  expect(extractImageMetadata(bytes)).toEqual({ Description: "p" });
  expect(extractStealthMetadata).toHaveBeenCalledWith(bytes);
});

test("returns null when neither source has a value", () => {
  jest.mocked(extractStealthMetadata).mockReturnValue({ Description: "" });

  expect(extractImageMetadata(bytes)).toBeNull();
});
