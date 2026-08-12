import { useEffect, useRef } from "react";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export type PredictiveBackEvent = {
  progress: number;
  swipeEdge: number;
  touchX: number;
  touchY: number;
};

export type PredictiveBackHandlers = {
  onStart?: (event: PredictiveBackEvent) => void;
  onProgress?: (event: PredictiveBackEvent) => void;
  onCancel?: () => void;
  onCommit?: () => void;
};

type PredictiveBackNativeModule = {
  progressAvailable: boolean;
  setMode: (mode: "app" | "system") => void;
  addListener: (
    eventName: string,
    listener: (event: PredictiveBackEvent) => void,
  ) => { remove: () => void };
};

const nativeModule =
  Platform.OS === "android"
    ? requireOptionalNativeModule<PredictiveBackNativeModule>("PredictiveBack")
    : null;

export const PREDICTIVE_BACK_SUPPORTED = nativeModule != null;
export const PREDICTIVE_BACK_HAS_PROGRESS =
  nativeModule?.progressAvailable === true;

const owners = new Map<object, PredictiveBackHandlers>();
const observers = new Set<PredictiveBackHandlers>();
let subscriptions: Array<{ remove: () => void }> | null = null;
let appliedMode: "app" | "system" | null = null;

function currentHandlers() {
  let current: PredictiveBackHandlers | undefined;
  for (const handlers of owners.values()) {
    current = handlers;
  }
  return current;
}

function dispatch(
  name: keyof PredictiveBackHandlers,
  event?: PredictiveBackEvent,
) {
  const handler = currentHandlers()?.[name];
  if (handler) {
    if (name === "onStart" || name === "onProgress") {
      (handler as (nextEvent: PredictiveBackEvent) => void)(event!);
    } else {
      (handler as () => void)();
    }
  }

  for (const observer of observers) {
    const observerHandler = observer[name];
    if (!observerHandler) continue;

    if (name === "onStart" || name === "onProgress") {
      (observerHandler as (nextEvent: PredictiveBackEvent) => void)(event!);
    } else {
      (observerHandler as () => void)();
    }
  }
}

function ensureSubscribed() {
  if (!nativeModule || subscriptions) return;

  subscriptions = [
    nativeModule.addListener("predictiveBackStart", (event) =>
      dispatch("onStart", event),
    ),
    nativeModule.addListener("predictiveBackProgress", (event) =>
      dispatch("onProgress", event),
    ),
    nativeModule.addListener("predictiveBackCancel", () =>
      dispatch("onCancel"),
    ),
    nativeModule.addListener("predictiveBackCommit", () =>
      dispatch("onCommit"),
    ),
  ];
}

function applyMode(force = false) {
  if (!nativeModule) return;

  const nextMode = owners.size > 0 ? "app" : "system";
  if (!force && appliedMode === nextMode) return;

  appliedMode = nextMode;
  nativeModule.setMode(nextMode);
}

export function initializePredictiveBack() {
  ensureSubscribed();
  applyMode(true);
}

export function acquirePredictiveBack(
  token: object,
  handlers: PredictiveBackHandlers,
) {
  if (!nativeModule) return;

  ensureSubscribed();
  owners.delete(token);
  owners.set(token, handlers);
  applyMode(true);
}

export function releasePredictiveBack(token: object) {
  if (!nativeModule || !owners.delete(token)) return;
  applyMode(true);
}

export function observePredictiveBack(handlers: PredictiveBackHandlers) {
  if (!nativeModule) return () => {};

  ensureSubscribed();
  observers.add(handlers);
  return () => observers.delete(handlers);
}

export function usePredictiveBackHandler(
  enabled: boolean,
  handlers: PredictiveBackHandlers,
) {
  const token = useRef({}).current;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !nativeModule) return;

    acquirePredictiveBack(token, {
      onStart: (event) => handlersRef.current.onStart?.(event),
      onProgress: (event) => handlersRef.current.onProgress?.(event),
      onCancel: () => handlersRef.current.onCancel?.(),
      onCommit: () => handlersRef.current.onCommit?.(),
    });

    return () => releasePredictiveBack(token);
  }, [enabled, token]);
}
