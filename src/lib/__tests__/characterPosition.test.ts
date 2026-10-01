import {
  gridCoordinate,
  hasOverlappingPositions,
  positionCellIndex,
} from "../characterPosition";

function character(x: number, y: number, enabled = true) {
  return { enabled, position: { x, y } };
}

test("maps grid cells to their centers and back", () => {
  expect([0, 2, 4].map(gridCoordinate)).toEqual([0.1, 0.5, 0.9]);
  expect(positionCellIndex({ x: 0.1, y: 0.9 })).toBe(20);
  expect(positionCellIndex({ x: 1, y: 1 })).toBe(24);
  expect(positionCellIndex({ x: 0, y: 0 })).toBe(0);
});

test("detects enabled characters sharing a cell", () => {
  expect(hasOverlappingPositions([character(0.5, 0.5)])).toBe(false);
  expect(
    hasOverlappingPositions([character(0.5, 0.5), character(0.1, 0.5)]),
  ).toBe(false);
  expect(
    hasOverlappingPositions([character(0.5, 0.5), character(0.55, 0.45)]),
  ).toBe(true);
  expect(
    hasOverlappingPositions([character(0.5, 0.5), character(0.5, 0.5, false)]),
  ).toBe(false);
});
