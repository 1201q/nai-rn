import { getModelCapabilities } from "../constants/models";
import {
  deleteStoredI2IReference,
  saveI2IReferenceImage,
} from "../lib/i2iReference";
import {
  addPreciseReferenceFromImage,
  deletePreciseReference as deleteStoredPreciseReference,
  replacePreciseReferenceImage,
  updatePreciseReferenceSettings,
  type PreciseReference,
} from "../lib/preciseReferences";
import { createMutationVersionTracker } from "../lib/referenceMutation";
import {
  addVibeReferenceFromImage,
  deleteVibeReference as deleteStoredVibeReference,
  replaceVibeReferenceImage,
  updateVibeReferenceSettings,
  type VibeReference,
} from "../lib/vibeReferences";
import { toErrorMessage } from "./generationErrorMessage";
import type {
  GenerationState,
  StoreGet,
  StoreSet,
} from "./generationStoreTypes";

const DEFAULT_I2I_STRENGTH = 0.7;
const DEFAULT_I2I_NOISE = 0;
export const REFERENCE_CONFLICT_MESSAGE =
  "Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.";
export const PRECISE_UNSUPPORTED_MESSAGE =
  "Precise Reference는 V4.5 모델에서 사용할 수 있습니다.";

type ReferenceList<T extends { id: string }> = {
  versions: ReturnType<typeof createMutationVersionTracker>;
  select: (state: GenerationState) => T[];
  assign: (items: T[]) => Partial<GenerationState>;
};

const vibeReferenceList: ReferenceList<VibeReference> = {
  versions: createMutationVersionTracker(),
  select: (state) => state.vibeReferences,
  assign: (vibeReferences) => ({ vibeReferences }),
};

const preciseReferenceList: ReferenceList<PreciseReference> = {
  versions: createMutationVersionTracker(),
  select: (state) => state.preciseReferences,
  assign: (preciseReferences) => ({ preciseReferences }),
};

// 설정을 즉시 반영한 뒤 저장한다. 저장 결과와 실패는 같은 reference의 마지막 변경일 때만 반영한다.
function updateReferenceSettings<T extends { id: string; imagePath: string }>(
  set: StoreSet,
  list: ReferenceList<T>,
  id: string,
  patch: Partial<T>,
  persist: () => Promise<T | null>,
) {
  const version = list.versions.start(id);
  set((state) =>
    list.assign(
      list
        .select(state)
        .map((item) => (item.id === id ? { ...item, ...patch } : item)),
    ),
  );
  persist()
    .then((reference) => {
      if (!reference || !list.versions.isLatest(id, version)) return;
      set((state) =>
        list.assign(
          list
            .select(state)
            .map((item) =>
              item.id === id && item.imagePath === reference.imagePath
                ? reference
                : item,
            ),
        ),
      );
    })
    .catch((error: unknown) => {
      if (!list.versions.isLatest(id, version)) return;
      set({ message: toErrorMessage(error) });
    });
}

type GenerationReferenceState = Pick<
  GenerationState,
  | "vibeReferences"
  | "normalizeVibeStrengths"
  | "setNormalizeVibeStrengths"
  | "addVibeReference"
  | "replaceVibeReference"
  | "removeVibeReference"
  | "setVibeReferenceEnabled"
  | "setVibeReferenceStrength"
  | "setVibeReferenceInformationExtracted"
  | "preciseReferences"
  | "addPreciseReference"
  | "replacePreciseReference"
  | "removePreciseReference"
  | "setPreciseReferenceEnabled"
  | "setPreciseReferenceStrength"
  | "setPreciseReferenceFidelity"
  | "setPreciseReferenceType"
  | "i2iSourceImage"
  | "setI2ISourceImage"
  | "i2iEnabled"
  | "setI2IEnabled"
  | "i2iStrength"
  | "setI2IStrength"
  | "i2iNoise"
  | "setI2INoise"
  | "clearI2I"
>;

export function createGenerationReferenceActions(
  set: StoreSet,
  get: StoreGet,
): GenerationReferenceState {
  let i2iMutationVersion = 0;
  return {
    vibeReferences: [],
    normalizeVibeStrengths: true,
    setNormalizeVibeStrengths: (v) => set({ normalizeVibeStrengths: v }),
    addVibeReference: async (input) => {
      if (get().preciseReferences.some((item) => item.enabled)) {
        set({
          message: REFERENCE_CONFLICT_MESSAGE,
        });
        return null;
      }

      try {
        const reference = await addVibeReferenceFromImage(input);
        set((state) => ({
          vibeReferences: [...state.vibeReferences, reference],
        }));
        return reference;
      } catch (error: unknown) {
        set({
          message: toErrorMessage(error, "Vibe 이미지를 추가하지 못했습니다."),
        });
        return null;
      }
    },
    replaceVibeReference: async (id, input) => {
      try {
        const reference = await replaceVibeReferenceImage(id, input);
        if (!reference) return null;
        set((state) => ({
          vibeReferences: state.vibeReferences.map((item) =>
            item.id === id
              ? {
                  ...item,
                  imagePath: reference.imagePath,
                  thumbnailPath: reference.thumbnailPath,
                  encodings: reference.encodings,
                  updatedAt: Math.max(item.updatedAt, reference.updatedAt),
                }
              : item,
          ),
        }));
        return reference;
      } catch (error: unknown) {
        set({
          message: toErrorMessage(error, "Vibe 이미지를 교체하지 못했습니다."),
        });
        return null;
      }
    },
    removeVibeReference: async (id) => {
      try {
        await deleteStoredVibeReference(id);
        vibeReferenceList.versions.clear(id);
        set((state) => ({
          vibeReferences: state.vibeReferences.filter((item) => item.id !== id),
        }));
      } catch (error: unknown) {
        set({
          message: toErrorMessage(error, "Vibe 이미지를 삭제하지 못했습니다."),
        });
      }
    },
    setVibeReferenceEnabled: (id, enabled) => {
      if (enabled && get().preciseReferences.some((item) => item.enabled)) {
        set({ message: REFERENCE_CONFLICT_MESSAGE });
        return;
      }
      updateReferenceSettings(set, vibeReferenceList, id, { enabled }, () =>
        updateVibeReferenceSettings(id, { enabled }),
      );
    },
    setVibeReferenceStrength: (id, strength) => {
      updateReferenceSettings(set, vibeReferenceList, id, { strength }, () =>
        updateVibeReferenceSettings(id, { strength }),
      );
    },
    setVibeReferenceInformationExtracted: (id, value) => {
      // Information Extracted가 바뀌면 모든 모델의 인코딩 캐시가 무효화된다.
      updateReferenceSettings(
        set,
        vibeReferenceList,
        id,
        { informationExtracted: value, encodings: [] },
        () => updateVibeReferenceSettings(id, { informationExtracted: value }),
      );
    },
    preciseReferences: [],
    addPreciseReference: async (input) => {
      if (get().vibeReferences.some((item) => item.enabled)) {
        set({
          message: REFERENCE_CONFLICT_MESSAGE,
        });
        return null;
      }

      try {
        const reference = await addPreciseReferenceFromImage(input);
        set((state) => ({
          preciseReferences: [...state.preciseReferences, reference],
        }));
        return reference;
      } catch (error: unknown) {
        set({
          message: toErrorMessage(
            error,
            "Precise Reference 이미지를 추가하지 못했습니다.",
          ),
        });
        return null;
      }
    },
    replacePreciseReference: async (id, input) => {
      try {
        const reference = await replacePreciseReferenceImage(id, input);
        if (!reference) return null;
        set((state) => ({
          preciseReferences: state.preciseReferences.map((item) =>
            item.id === id
              ? {
                  ...item,
                  imagePath: reference.imagePath,
                  thumbnailPath: reference.thumbnailPath,
                  processedPath: reference.processedPath,
                  sourceWidth: reference.sourceWidth,
                  sourceHeight: reference.sourceHeight,
                  processedWidth: reference.processedWidth,
                  processedHeight: reference.processedHeight,
                  updatedAt: Math.max(item.updatedAt, reference.updatedAt),
                }
              : item,
          ),
        }));
        return reference;
      } catch (error: unknown) {
        set({
          message: toErrorMessage(
            error,
            "Precise Reference 이미지를 교체하지 못했습니다.",
          ),
        });
        return null;
      }
    },
    removePreciseReference: async (id) => {
      try {
        await deleteStoredPreciseReference(id);
        preciseReferenceList.versions.clear(id);
        set((state) => ({
          preciseReferences: state.preciseReferences.filter(
            (item) => item.id !== id,
          ),
        }));
      } catch (error: unknown) {
        set({
          message: toErrorMessage(
            error,
            "Precise Reference 이미지를 삭제하지 못했습니다.",
          ),
        });
      }
    },
    setPreciseReferenceEnabled: (id, enabled) => {
      if (enabled && get().vibeReferences.some((item) => item.enabled)) {
        set({ message: REFERENCE_CONFLICT_MESSAGE });
        return;
      }
      if (enabled && !getModelCapabilities(get().model).preciseReference) {
        set({ message: PRECISE_UNSUPPORTED_MESSAGE });
        return;
      }
      updateReferenceSettings(set, preciseReferenceList, id, { enabled }, () =>
        updatePreciseReferenceSettings(id, { enabled }),
      );
    },
    setPreciseReferenceStrength: (id, strength) => {
      updateReferenceSettings(set, preciseReferenceList, id, { strength }, () =>
        updatePreciseReferenceSettings(id, { strength }),
      );
    },
    setPreciseReferenceFidelity: (id, fidelity) => {
      updateReferenceSettings(set, preciseReferenceList, id, { fidelity }, () =>
        updatePreciseReferenceSettings(id, { fidelity }),
      );
    },
    setPreciseReferenceType: (id, referenceType) => {
      updateReferenceSettings(
        set,
        preciseReferenceList,
        id,
        { referenceType },
        () => updatePreciseReferenceSettings(id, { referenceType }),
      );
    },
    i2iSourceImage: null,
    setI2ISourceImage: async (v) => {
      const version = ++i2iMutationVersion;
      try {
        const storedImage = await saveI2IReferenceImage(v);
        if (version !== i2iMutationVersion) {
          deleteStoredI2IReference(storedImage.storagePath);
          return null;
        }
        const previousPath = get().i2iSourceImage?.storagePath;
        set({ i2iSourceImage: storedImage, i2iEnabled: true });
        if (previousPath !== storedImage.storagePath) {
          deleteStoredI2IReference(previousPath);
        }
        return storedImage;
      } catch (error: unknown) {
        if (version !== i2iMutationVersion) return null;
        set({
          message: toErrorMessage(error, "I2I 이미지를 저장하지 못했습니다."),
        });
        return null;
      }
    },
    i2iEnabled: false,
    setI2IEnabled: (v) =>
      set((state) => ({ i2iEnabled: v && Boolean(state.i2iSourceImage) })),
    i2iStrength: DEFAULT_I2I_STRENGTH,
    setI2IStrength: (v) => set({ i2iStrength: v }),
    i2iNoise: DEFAULT_I2I_NOISE,
    setI2INoise: (v) => set({ i2iNoise: v }),
    clearI2I: () => {
      i2iMutationVersion += 1;
      const storagePath = get().i2iSourceImage?.storagePath;
      set({
        i2iSourceImage: null,
        i2iEnabled: false,
        i2iStrength: DEFAULT_I2I_STRENGTH,
        i2iNoise: DEFAULT_I2I_NOISE,
      });
      deleteStoredI2IReference(storagePath);
    },
  };
}
