import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  imageUpscaler,
  type UpscaleGpuInfo,
} from "../../../modules/image-upscaler";
import { tokens } from "../../styles/tokens";
import { UpscaleOptionLabel } from "./UpscaleOptionLabel";

export function UpscaleGpuMemory({ active }: { active: boolean }) {
  const [info, setInfo] = useState<UpscaleGpuInfo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active || !imageUpscaler) return;
    let cancelled = false;
    imageUpscaler
      .getGpuInfo()
      .then((result) => {
        if (cancelled) return;
        setInfo(result);
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setInfo(null);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const value =
    !imageUpscaler || failed
      ? "조회할 수 없음"
      : info === null
        ? "조회 중…"
        : info.available && info.heapBudgetMiB !== null
          ? `${info.heapBudgetMiB.toLocaleString()} MiB`
          : "GPU 없음 · CPU 사용";

  return (
    <View style={styles.field}>
      <View style={styles.row}>
        <UpscaleOptionLabel
          label="GPU 메모리 예산"
          active={active}
          description="자동 타일 계산에 쓰는 조회 시점의 메모리 예산입니다. 기기에 따라 추정값일 수 있습니다."
        />
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  value: {
    color: tokens.color.textSecondary,
    fontFamily: tokens.font.medium,
    fontSize: 14,
    fontVariant: ["tabular-nums"],
  },
});
