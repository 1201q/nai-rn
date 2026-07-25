import {
  GENERATION_OPTIONS_PERSIST_DEBOUNCE_MS,
  createGenerationOptionsPersistence,
  selectPersistedOptions,
  type PersistableGenerationState,
} from "../generationOptionsPersistence";

function createState(
  overrides: Partial<PersistableGenerationState> = {},
): PersistableGenerationState {
  return {
    prompt: "prompt",
    negativePrompt: "negative",
    qualityToggle: true,
    ucPreset: 1,
    characterPrompts: [],
    characterPromptExpandedIds: [],
    characterPositionEnabled: false,
    model: "model",
    resolution: { label: "Normal", width: 832, height: 1216 },
    customResolutions: [],
    steps: 28,
    promptGuidance: 5,
    promptGuidanceRescale: 0,
    noiseSchedule: "karras",
    sampler: "k_euler_ancestral",
    seed: 123,
    seedLocked: false,
    batchCount: 1,
    varietyPlus: false,
    normalizeVibeStrengths: true,
    vibeReferenceExpandedIds: [],
    preciseReferenceExpandedIds: [],
    i2iSourceImage: null,
    i2iEnabled: false,
    i2iStrength: 0.7,
    i2iNoise: 0,
    mainImageBlurred: false,
    ...overrides,
  };
}

describe("generation options persistence", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test("selects only the persisted image fields and unlocked seed rule", () => {
    const options = selectPersistedOptions(
      createState({
        seed: 456,
        seedLocked: false,
        i2iSourceImage: {
          uri: "file:///source.png",
          storagePath: "/stored/source.png",
          width: 1024,
          height: 768,
        },
      }),
    );

    expect(options.seed).toBeUndefined();
    expect(options.i2iSourceImage).toEqual({
      storagePath: "/stored/source.png",
      width: 1024,
      height: 768,
    });
    expect(
      selectPersistedOptions(
        createState({ seed: 456, seedLocked: true }),
      ).seed,
    ).toBe(456);
  });

  test("does not serialize or write for 20 runtime-only changes", () => {
    const write = jest.fn();
    const stringify = jest.spyOn(JSON, "stringify");
    const persistence = createGenerationOptionsPersistence({
      initialJson: null,
      write,
    });
    let previousState = { ...createState(), streamingStep: 0 };

    for (let streamingStep = 1; streamingStep <= 20; streamingStep += 1) {
      const state = { ...previousState, streamingStep };
      persistence.handleStateChange(state, previousState);
      previousState = state;
    }
    jest.runAllTimers();

    expect(stringify).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  test("writes only the last state after rapid option changes", () => {
    const write = jest.fn();
    const persistence = createGenerationOptionsPersistence({
      initialJson: null,
      write,
    });
    const initialState = createState();
    const firstState = { ...initialState, prompt: "first" };
    const lastState = { ...firstState, prompt: "last" };

    persistence.handleStateChange(firstState, initialState);
    persistence.handleStateChange(lastState, firstState);
    jest.advanceTimersByTime(
      GENERATION_OPTIONS_PERSIST_DEBOUNCE_MS - 1,
    );
    expect(write).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(write.mock.calls[0][0]).prompt).toBe("last");
  });

  test("flushes a pending write immediately without a later duplicate", () => {
    const write = jest.fn();
    const persistence = createGenerationOptionsPersistence({
      initialJson: null,
      write,
    });
    const initialState = createState();
    const state = { ...initialState, steps: 30 };

    persistence.handleStateChange(state, initialState);
    persistence.flush();

    expect(write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(write.mock.calls[0][0]).steps).toBe(30);

    jest.runAllTimers();
    expect(write).toHaveBeenCalledTimes(1);
  });

  test("ignores seed changes while the seed is unlocked", () => {
    const write = jest.fn();
    const persistence = createGenerationOptionsPersistence({
      initialJson: null,
      write,
    });
    const initialState = createState({ seed: 100, seedLocked: false });
    const state = { ...initialState, seed: 200 };

    persistence.handleStateChange(state, initialState);
    jest.runAllTimers();

    expect(write).not.toHaveBeenCalled();
  });

  test("skips a write when the final options match stored JSON", () => {
    const write = jest.fn();
    const initialState = createState();
    const persistence = createGenerationOptionsPersistence({
      initialJson: JSON.stringify(selectPersistedOptions(initialState)),
      write,
    });
    const changedState = { ...initialState, prompt: "changed" };

    persistence.handleStateChange(changedState, initialState);
    persistence.handleStateChange(initialState, changedState);
    jest.runAllTimers();

    expect(write).not.toHaveBeenCalled();
  });
});
