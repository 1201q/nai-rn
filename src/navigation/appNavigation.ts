import { useMemo } from "react";
import { StateNavigator, type StateInfo } from "navigation";
import { useNavigationEvent } from "navigation-react";

export type AppRoute =
  | "home"
  | "history"
  | "imageSettings"
  | "imageToImage"
  | "metadataExtract"
  | "preciseReference"
  | "settings"
  | "vibeTransfer";

type AppNavigationInfo = Record<AppRoute, undefined>;

const stateInfos: StateInfo<AppRoute>[] = [
  { key: "home" },
  { key: "history", trackCrumbTrail: true },
  { key: "imageSettings", trackCrumbTrail: true },
  { key: "imageToImage", trackCrumbTrail: true },
  { key: "metadataExtract", trackCrumbTrail: true },
  { key: "preciseReference", trackCrumbTrail: true },
  { key: "settings", trackCrumbTrail: true },
  { key: "vibeTransfer", trackCrumbTrail: true },
];

export const appStateNavigator = new StateNavigator<AppNavigationInfo>(
  stateInfos,
);

export function useAppNavigation() {
  const { stateNavigator } = useNavigationEvent<AppNavigationInfo>();

  return useMemo(
    () => ({
      navigate(route: AppRoute) {
        stateNavigator.navigate(route);
      },
      back() {
        if (stateNavigator.canNavigateBack(1)) {
          stateNavigator.navigateBack(1);
          return;
        }
        stateNavigator.navigate("home");
      },
    }),
    [stateNavigator],
  );
}
