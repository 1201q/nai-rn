import { StyleSheet, Text, View } from "react-native";

import { SheetSliderControls } from "../../components/forms/SheetSliderControls";
import type { UpscaleSettings } from "../../store/upscaleQueueStore";
import { upscalePageStyles } from "./UpscaleSettingsRow";
import { UpscaleOptionLabel } from "./UpscaleOptionLabel";

export function UpscaleQualityControl({
  settings,
  active,
  onChange,
  inSheet = true,
  portalHostName,
}: {
  settings: UpscaleSettings;
  active: boolean;
  inSheet?: boolean;
  portalHostName?: string;
  onChange: (patch: Partial<UpscaleSettings>) => void;
}) {
  return (
    <View style={settings.format === "png" ? undefined : styles.field}>
      {settings.format === "png" ? (
        <UpscaleOptionLabel
          label="Image quality"
          active={active}
          portalHostName={portalHostName}
          description="JPG와 WebP의 저장 품질을 1~100으로 지정합니다. 높은 값은 일반적으로 용량이 커집니다. PNG는 무손실 형식으로 품질을 조절하지 않습니다."
        />
      ) : null}
      {settings.format === "png" ? (
        <Text style={upscalePageStyles.description}>무손실</Text>
      ) : (
        <SheetSliderControls
          key={settings.format}
          inSheet={inSheet}
          header={
            <UpscaleOptionLabel
              label="Image quality"
              active={active}
              portalHostName={portalHostName}
              description="JPG와 WebP의 저장 품질을 1~100으로 지정합니다. 높은 값은 일반적으로 용량이 커집니다."
            />
          }
          label="Image quality"
          active={active}
          value={
            settings.format === "webp"
              ? settings.webpQuality
              : settings.jpgQuality
          }
          min={1}
          max={100}
          step={1}
          precision={0}
          onChange={(quality) =>
            onChange(
              settings.format === "webp"
                ? { webpQuality: quality }
                : { jpgQuality: quality },
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 14 },
});
