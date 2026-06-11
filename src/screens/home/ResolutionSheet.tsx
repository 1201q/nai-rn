import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  BottomSheetTextInput,
  TouchableOpacity as BottomSheetTouchableOpacity,
} from "@gorhom/bottom-sheet";

import { NAI_RESOLUTIONS, type NaiResolution } from "../../constants/generation";
import { light, styles } from "./styles";
import { SheetItem } from "./primitives";

export function ResolutionSheetContent({
  resolution,
  onChange,
  onClose,
  showTitle = true,
}: {
  resolution: NaiResolution;
  onChange: (v: NaiResolution) => void;
  onClose: () => void;
  showTitle?: boolean;
}) {
  const setDimension = (key: "width" | "height", text: string) => {
    const digits = text.replace(/\D/g, "");
    onChange({
      label: "Custom",
      width: key === "width" ? Number(digits || 0) : resolution.width,
      height: key === "height" ? Number(digits || 0) : resolution.height,
    });
  };

  // 입력 확정 시 64 배수로 스냅 (최소 64)
  const snapDimension = (key: "width" | "height") => {
    const v = resolution[key];
    const snapped = v ? Math.max(64, Math.round(v / 64) * 64) : 0;
    if (snapped !== v) {
      onChange({ ...resolution, label: "Custom", [key]: snapped });
    }
  };

  const swap = () => {
    onChange({
      label: "Custom",
      width: resolution.height,
      height: resolution.width,
    });
  };

  const visibleGroups = NAI_RESOLUTIONS.filter((g) => g.group === "Normal");
  const isCustom = !visibleGroups.some((g) =>
    g.options.some(
      (o) => o.width === resolution.width && o.height === resolution.height,
    ),
  );

  return (
    <>
      {showTitle ? <Text style={styles.sheetTitle}>Resolution</Text> : null}

      <View style={styles.resolutionInputRow}>
        <View style={styles.resolutionInputBox}>
          <Text style={styles.resolutionInputLabel}>W</Text>
          <BottomSheetTextInput
            style={styles.resolutionInput}
            value={resolution.width ? String(resolution.width) : ""}
            onChangeText={(t) => setDimension("width", t)}
            onEndEditing={() => snapDimension("width")}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={light.textHint}
          />
        </View>
        <BottomSheetTouchableOpacity
          style={styles.resolutionSwapButton}
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            swap();
          }}
        >
          <Ionicons
            name="swap-horizontal"
            size={20}
            color={light.textSecondary}
          />
        </BottomSheetTouchableOpacity>
        <View style={styles.resolutionInputBox}>
          <Text style={styles.resolutionInputLabel}>H</Text>
          <BottomSheetTextInput
            style={styles.resolutionInput}
            value={resolution.height ? String(resolution.height) : ""}
            onChangeText={(t) => setDimension("height", t)}
            onEndEditing={() => snapDimension("height")}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={light.textHint}
          />
        </View>
      </View>

      {visibleGroups.map((group) => (
        <View key={group.group}>
          <Text style={styles.resolutionGroupLabel}>{group.group}</Text>
          {group.options.map((opt) => (
            <SheetItem
              key={opt.label}
              item={{ value: opt.label, label: opt.label }}
              isActive={
                opt.width === resolution.width &&
                opt.height === resolution.height
              }
              onPress={() => {
                onChange({
                  label: opt.label,
                  width: opt.width,
                  height: opt.height,
                });
                onClose();
              }}
            />
          ))}
        </View>
      ))}

      <View>
        <Text style={styles.resolutionGroupLabel}>Custom</Text>
        <SheetItem
          item={{ value: "custom", label: "Custom" }}
          isActive={isCustom}
          onPress={onClose}
        />
      </View>
    </>
  );
}
