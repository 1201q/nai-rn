import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { HelpButton } from "../../components/forms/HelpButton";
import { tokens } from "../../styles/tokens";
import { UPSCALE_SELECT_PORTAL_HOST } from "./upscaleOptions";

type Props = {
  label: string;
  description: string;
  active?: boolean;
  portalHostName?: string;
};

export function UpscaleHelpButton(props: Props) {
  return (
    <StatefulHelpButton
      key={props.active === false ? "inactive" : "active"}
      {...props}
    />
  );
}

function StatefulHelpButton({
  label,
  description,
  active = true,
  portalHostName = UPSCALE_SELECT_PORTAL_HOST,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <HelpButton
      label={label}
      description={description}
      open={active && open}
      onToggle={() => {
        if (active) setOpen((current) => !current);
      }}
      portalHostName={portalHostName}
    />
  );
}

export function UpscaleOptionLabel(props: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{props.label}</Text>
      <UpscaleHelpButton {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexShrink: 1,
  },
  label: {
    color: tokens.color.textPrimary,
    fontFamily: tokens.font.semibold,
    fontSize: tokens.type.md,
    flexShrink: 1,
  },
});
