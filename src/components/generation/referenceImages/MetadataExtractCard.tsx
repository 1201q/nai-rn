import { useRef, useState } from "react";
import { File } from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { toast } from "sonner-native";

import { extractImageMetadata } from "../../../lib/imageMetadata";
import { ReferenceSection } from "./ReferenceParts";

export function MetadataExtractCard({
  onExtract,
}: {
  onExtract: (metadataJson: string) => void;
}) {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  async function pickImage() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error("이미지를 선택하려면 사진 접근 권한이 필요합니다.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
        base64: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      const bytes = await new File(asset.uri).bytes();
      const metadata = extractImageMetadata(bytes);
      if (!metadata) {
        toast.info("이미지에 메타데이터가 없습니다.");
        return;
      }
      onExtract(JSON.stringify(metadata));
    } catch {
      toast.error("이미지에서 메타데이터를 추출하지 못했습니다.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <ReferenceSection
      title="Metadata Extract"
      description="이미지에서 메타데이터를 추출합니다."
      icon="information-circle-outline"
      count={0}
      limit={1}
      busy={busy}
      onAdd={() => void pickImage()}
    />
  );
}
