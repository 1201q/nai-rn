import { useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";

import { getModelCapabilities } from "../../../constants/models";
import { MAX_PRECISE_REFERENCES } from "../../../lib/preciseReferences";
import { MAX_VIBE_REFERENCES } from "../../../lib/vibeReferences";
import { useGenerationStore } from "../../../store/generationStore";

type ReferenceKind = "i2i" | "vibe" | "precise";

export function useReferenceUpload(kind: ReferenceKind) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  async function pickImage() {
    if (pending.current) return;
    const state = useGenerationStore.getState();
    if (
      kind === "precise" &&
      !getModelCapabilities(state.model).preciseReference
    ) {
      state.setMessage("Precise Reference는 V4.5 모델에서 사용할 수 있습니다.");
      return;
    }
    if (
      (kind === "vibe" &&
        state.preciseReferences.some((item) => item.enabled)) ||
      (kind === "precise" && state.vibeReferences.some((item) => item.enabled))
    ) {
      state.setMessage(
        "Precise Reference와 Vibe Transfer는 함께 사용할 수 없습니다.",
      );
      return;
    }
    if (
      (kind === "vibe" && state.vibeReferences.length >= MAX_VIBE_REFERENCES) ||
      (kind === "precise" &&
        state.preciseReferences.length >= MAX_PRECISE_REFERENCES)
    )
      return;
    pending.current = true;
    setBusy(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        state.setMessage("이미지를 선택하려면 사진 접근 권한이 필요합니다.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        base64: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      const input = {
        uri: asset.uri,
        width: asset.width || 64,
        height: asset.height || 64,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      };
      const current = useGenerationStore.getState();
      if (kind === "i2i") await current.setI2ISourceImage(input);
      else if (
        kind === "vibe" &&
        current.vibeReferences.length < MAX_VIBE_REFERENCES
      )
        await current.addVibeReference(input);
      else if (
        kind === "precise" &&
        current.preciseReferences.length < MAX_PRECISE_REFERENCES &&
        getModelCapabilities(current.model).preciseReference
      )
        await current.addPreciseReference(input);
    } catch {
      state.setMessage("참조 이미지를 선택하지 못했습니다.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { busy, pickImage };
}
