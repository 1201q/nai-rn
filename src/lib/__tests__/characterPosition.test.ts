import {
  gridCoordinate,
  hasOverlappingPositions,
  nextCharacterPosition,
  overlappingPositionIndexes,
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

test("free placement detects overlap by distance instead of cell", () => {
  // 같은 셀이지만 충분히 떨어져 있다.
  const sameCell = [character(0.41, 0.41), character(0.59, 0.59)];
  expect(hasOverlappingPositions(sameCell)).toBe(true);
  expect(hasOverlappingPositions(sameCell, true)).toBe(false);
  // 다른 셀이지만 가깝다.
  const neighbors = [character(0.39, 0.5), character(0.41, 0.5)];
  expect(hasOverlappingPositions(neighbors)).toBe(false);
  expect(hasOverlappingPositions(neighbors, true)).toBe(true);
});

test("lists every enabled character that overlaps another", () => {
  expect([
    ...overlappingPositionIndexes([
      character(0.5, 0.5),
      character(0.1, 0.1),
      character(0.5, 0.5, false),
      character(0.5, 0.5),
    ]),
  ]).toEqual([3, 0]);
});

test("places new characters center, left, right without overlapping", () => {
  const characters: ReturnType<typeof character>[] = [];
  for (let count = 0; count < 22; count += 1) {
    const { x, y } = nextCharacterPosition(characters);
    characters.push(character(x, y));
  }
  expect(characters.slice(0, 6).map((item) => item.position)).toEqual([
    { x: 0.5, y: 0.5 },
    { x: 0.3, y: 0.5 },
    { x: 0.7, y: 0.5 },
    { x: 0.1, y: 0.5 },
    { x: 0.9, y: 0.5 },
    { x: 0.5, y: 0.3 },
  ]);
  expect(hasOverlappingPositions(characters)).toBe(false);
  expect(hasOverlappingPositions(characters, true)).toBe(false);
});

test("skips cells that existing characters already use", () => {
  expect(
    nextCharacterPosition([character(0.5, 0.5), character(0.3, 0.5)]),
  ).toEqual({ x: 0.7, y: 0.5 });
  expect(nextCharacterPosition([character(0.1, 0.1)])).toEqual({
    x: 0.5,
    y: 0.5,
  });
});
