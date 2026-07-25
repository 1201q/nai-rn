import { MAX_CHARACTER_PROMPTS } from "../../constants/generation";
import type { ParsedNaiMetadata } from "../naiMetadata";
import {
  buildMetadataImportPatch,
  type MetadataImportSelection,
  type MetadataImportState,
} from "../metadataImport";

function createCharacter(id: string) {
  return {
    id,
    prompt: `${id} prompt`,
    negativePrompt: `${id} negative`,
    enabled: true,
    position: { x: 0.5, y: 0.5 },
  };
}

function createState(
  overrides: Partial<MetadataImportState> = {},
): MetadataImportState {
  return {
    prompt: "current prompt",
    negativePrompt: "current negative",
    characterPrompts: [],
    model: "current-model",
    resolution: { label: "Current", width: 832, height: 1216 },
    steps: 28,
    promptGuidance: 5,
    promptGuidanceRescale: 0,
    noiseSchedule: "karras",
    sampler: "k_euler_ancestral",
    varietyPlus: true,
    qualityToggle: true,
    ucPreset: 1,
    seed: 123,
    ...overrides,
  };
}

function createSelection(
  overrides: Partial<MetadataImportSelection> = {},
): MetadataImportSelection {
  return {
    prompt: false,
    negativePrompt: false,
    characters: false,
    characterMode: "replace",
    settings: false,
    seed: false,
    ...overrides,
  };
}

describe("buildMetadataImportPatch", () => {
  test("includes only selected metadata groups", () => {
    const resolution = { label: "Imported", width: 1024, height: 1024 };
    const parsed: ParsedNaiMetadata = {
      raw: {},
      prompt: "imported prompt",
      negativePrompt: "imported negative",
      characters: [createCharacter("imported")],
      model: "imported-model",
      resolution,
      steps: 12,
      promptGuidance: 0,
      promptGuidanceRescale: 0,
      noiseSchedule: "native",
      sampler: "k_euler",
      varietyPlus: false,
      qualityToggle: false,
      ucPreset: 0,
      seed: 0,
      hasSettings: true,
    };

    const patch = buildMetadataImportPatch(
      createState(),
      parsed,
      createSelection({
        negativePrompt: true,
        settings: true,
        seed: true,
      }),
    );

    expect(patch).toEqual({
      negativePrompt: "imported negative",
      model: "imported-model",
      resolution,
      steps: 12,
      promptGuidance: 0,
      promptGuidanceRescale: 0,
      noiseSchedule: "native",
      sampler: "k_euler",
      varietyPlus: false,
      qualityToggle: false,
      ucPreset: 0,
      seed: 0,
    });
  });

  test("appends characters up to the supported limit", () => {
    const currentCharacters = Array.from(
      { length: MAX_CHARACTER_PROMPTS - 1 },
      (_, index) => createCharacter(`current-${index}`),
    );
    const importedCharacters = [
      createCharacter("imported-0"),
      createCharacter("imported-1"),
    ];

    const patch = buildMetadataImportPatch(
      createState({ characterPrompts: currentCharacters }),
      {
        raw: {},
        characters: importedCharacters,
        hasSettings: false,
      },
      createSelection({ characters: true, characterMode: "append" }),
    );

    expect(patch.characterPrompts).toHaveLength(MAX_CHARACTER_PROMPTS);
    expect(patch.characterPrompts).toEqual([
      ...currentCharacters,
      importedCharacters[0],
    ]);
  });

  test("replaces characters without mutating the current state", () => {
    const currentCharacters = [createCharacter("current")];
    const importedCharacters = [createCharacter("imported")];
    const state = createState({ characterPrompts: currentCharacters });

    const patch = buildMetadataImportPatch(
      state,
      {
        raw: {},
        characters: importedCharacters,
        hasSettings: false,
      },
      createSelection({ characters: true }),
    );

    expect(patch.characterPrompts).toBe(importedCharacters);
    expect(state.characterPrompts).toBe(currentCharacters);
  });

  test("returns an empty patch when no metadata group is selected", () => {
    const patch = buildMetadataImportPatch(
      createState(),
      {
        raw: {},
        prompt: "imported prompt",
        hasSettings: false,
      },
      createSelection(),
    );

    expect(patch).toEqual({});
  });
});
