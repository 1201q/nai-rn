import type { CharacterPrompt } from "../types/generation";

export const POSITION_GRID_SIZE = 5;

type Position = CharacterPrompt["position"];

export function gridCoordinate(index: number) {
  return (index + 0.5) / POSITION_GRID_SIZE;
}

function gridIndex(value: number) {
  return Math.max(
    0,
    Math.min(POSITION_GRID_SIZE - 1, Math.floor(value * POSITION_GRID_SIZE)),
  );
}

export function positionCellIndex(position: Position) {
  return gridIndex(position.y) * POSITION_GRID_SIZE + gridIndex(position.x);
}

export function hasOverlappingPositions(
  characters: ReadonlyArray<Pick<CharacterPrompt, "enabled" | "position">>,
) {
  const cells = new Set<number>();
  for (const character of characters) {
    if (!character.enabled) continue;
    const cell = positionCellIndex(character.position);
    if (cells.has(cell)) return true;
    cells.add(cell);
  }
  return false;
}
