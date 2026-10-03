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

// 자유 배치(V5)에서 두 캐릭터가 겹친다고 보는 거리 (0..1 좌표 기준).
const POSITION_OVERLAP_DISTANCE = 0.15;

export function isNearPosition(a: Position, b: Position) {
  "worklet";
  return Math.hypot(a.x - b.x, a.y - b.y) < POSITION_OVERLAP_DISTANCE;
}

// 겹치는 활성 캐릭터의 배열 인덱스. 그리드는 같은 셀, 자유 배치는 거리로 판정한다.
export function overlappingPositionIndexes(
  characters: readonly Pick<CharacterPrompt, "enabled" | "position">[],
  freePlacement = false,
) {
  const indexes = new Set<number>();
  characters.forEach((character, index) => {
    if (!character.enabled) return;
    for (let other = 0; other < index; other += 1) {
      if (!characters[other].enabled) continue;
      const a = character.position;
      const b = characters[other].position;
      if (
        freePlacement
          ? isNearPosition(a, b)
          : positionCellIndex(a) === positionCellIndex(b)
      ) {
        indexes.add(index);
        indexes.add(other);
      }
    }
  });
  return indexes;
}

export function hasOverlappingPositions(
  characters: ReadonlyArray<Pick<CharacterPrompt, "enabled" | "position">>,
  freePlacement = false,
) {
  return overlappingPositionIndexes(characters, freePlacement).size > 0;
}

// 가운데 줄부터 가운데, 왼쪽, 오른쪽 순서로 번갈아 채운다.
const NEW_POSITION_ORDER = [2, 1, 3, 0, 4];

// 새 캐릭터가 기존 캐릭터와 겹치지 않도록 비어 있는 첫 셀을 고른다.
export function nextCharacterPosition(
  characters: readonly Pick<CharacterPrompt, "position">[],
): Position {
  const taken = new Set(
    characters.map((character) => positionCellIndex(character.position)),
  );
  for (const row of NEW_POSITION_ORDER) {
    for (const column of NEW_POSITION_ORDER) {
      if (!taken.has(row * POSITION_GRID_SIZE + column)) {
        return { x: gridCoordinate(column), y: gridCoordinate(row) };
      }
    }
  }
  return { x: 0.5, y: 0.5 };
}
