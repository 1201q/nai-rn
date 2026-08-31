import {
  MarkdownTextInput,
  type MarkdownRange,
  type MarkdownStyle,
  type MarkdownTextInputProps,
} from "@expensify/react-native-live-markdown";
import { useBottomSheetInternal } from "@gorhom/bottom-sheet";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ComponentRef,
} from "react";
import {
  findNodeHandle,
  TextInput,
  type BlurEvent,
  type FocusEvent,
} from "react-native";

import { parsePromptHighlights } from "../../lib/promptHighlight";
import { tokens } from "../../styles/tokens";

const promptMarkdownStyle: MarkdownStyle = {
  mentionUser: {
    color: tokens.color.textPrimary,
    backgroundColor: "#6e2c1c",
    borderRadius: 5,
  },
  mentionHere: {
    color: tokens.color.textPrimary,
    backgroundColor: "#204184",
    borderRadius: 5,
  },
  mentionReport: {
    color: tokens.color.textPrimary,
    backgroundColor: "#285125",
    borderRadius: 5,
  },
  syntax: {
    color: "#adb5bd",
  },
};

interface MarkdownRangeBackgroundColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

type PromptMarkdownRange = MarkdownRange & {
  backgroundColor?: MarkdownRangeBackgroundColor;
  foregroundColor?: MarkdownRangeBackgroundColor;
  fontFamily?: string;
};

const RANDOMIZER_FONT_FAMILY = tokens.font.medium;

function weightedBackgroundColor(weight: number): MarkdownRangeBackgroundColor {
  "worklet";

  const strength = Math.max(0, Math.min(1, Math.abs(weight - 1)));
  const alpha = Math.round((0.28 + 0.72 * strength) * 100) / 100;

  return weight < 1
    ? { red: 32, green: 65, blue: 132, alpha }
    : { red: 110, green: 44, blue: 28, alpha };
}

export function promptMarkdownParser(input: string): PromptMarkdownRange[] {
  "worklet";

  const ranges: PromptMarkdownRange[] = [];
  const spans = parsePromptHighlights(input);
  let start = 0;

  for (const span of spans) {
    let type: MarkdownRange["type"] | undefined;
    let backgroundColor: MarkdownRangeBackgroundColor | undefined;
    let foregroundColor: MarkdownRangeBackgroundColor | undefined;
    let fontFamily: string | undefined;

    if (span.weight !== undefined && Math.abs(span.weight - 1) > 0.0001) {
      type = span.weight < 1 ? "mention-here" : "mention-user";
      backgroundColor = weightedBackgroundColor(span.weight);
    } else if (span.kind === "numericMark") {
      type = "mention-report";
    } else if (span.kind === "randomizer" || span.kind === "separator") {
      type = "syntax";
      foregroundColor = { red: 245, green: 243, blue: 194, alpha: 1 };
      fontFamily = RANDOMIZER_FONT_FAMILY;
    } else if (span.kind === "bracket") {
      type = "syntax";
    }

    if (type !== undefined) {
      const range: PromptMarkdownRange = {
        type,
        start,
        length: span.text.length,
      };
      if (backgroundColor !== undefined) {
        range.backgroundColor = backgroundColor;
      }
      if (foregroundColor !== undefined) {
        range.foregroundColor = foregroundColor;
      }
      if (fontFamily !== undefined) {
        range.fontFamily = fontFamily;
      }
      ranges.push(range);
    }
    start += span.text.length;
  }

  return ranges;
}

export type PromptHighlightTextInputHandle = ComponentRef<
  typeof MarkdownTextInput
>;

type PromptHighlightTextInputProps = Omit<
  MarkdownTextInputProps,
  "markdownStyle" | "parser"
> & {
  bottomSheetAware?: boolean;
};

export const PromptHighlightTextInput = forwardRef<
  PromptHighlightTextInputHandle,
  PromptHighlightTextInputProps
>(function PromptHighlightTextInput(
  { bottomSheetAware = false, onBlur, onFocus, ...props },
  providedRef,
) {
  const inputRef = useRef<PromptHighlightTextInputHandle>(null);
  const bottomSheet = useBottomSheetInternal(true);
  const animatedKeyboardState = bottomSheet?.animatedKeyboardState;
  const textInputNodesRef = bottomSheet?.textInputNodesRef;

  const handleFocus = useCallback(
    (event: FocusEvent) => {
      if (bottomSheetAware && animatedKeyboardState) {
        animatedKeyboardState.set((state) => ({
          ...state,
          target: event.nativeEvent.target,
        }));
      }
      onFocus?.(event);
    },
    [animatedKeyboardState, bottomSheetAware, onFocus],
  );
  const handleBlur = useCallback(
    (event: BlurEvent) => {
      if (
        bottomSheetAware &&
        animatedKeyboardState &&
        textInputNodesRef
      ) {
        const keyboardState = animatedKeyboardState.get();
        const focusedInput = findNodeHandle(
          TextInput.State.currentlyFocusedInput() as unknown as Parameters<
            typeof findNodeHandle
          >[0],
        );
        const shouldRemoveTarget =
          keyboardState.target === event.nativeEvent.target;
        const shouldIgnoreBlur =
          focusedInput !== null && textInputNodesRef.current.has(focusedInput);

        if (shouldRemoveTarget && !shouldIgnoreBlur) {
          animatedKeyboardState.set((state) => ({
            ...state,
            target: undefined,
          }));
        }
      }
      onBlur?.(event);
    },
    [animatedKeyboardState, bottomSheetAware, onBlur, textInputNodesRef],
  );

  useEffect(() => {
    if (
      !bottomSheetAware ||
      !animatedKeyboardState ||
      !textInputNodesRef
    ) {
      return;
    }

    const inputNode = findNodeHandle(inputRef.current);
    if (inputNode === null) return;

    textInputNodesRef.current.add(inputNode);
    return () => {
      const keyboardState = animatedKeyboardState.get();
      if (keyboardState.target === inputNode) {
        animatedKeyboardState.set((state) => ({
          ...state,
          target: undefined,
        }));
      }
      textInputNodesRef.current.delete(inputNode);
    };
  }, [animatedKeyboardState, bottomSheetAware, textInputNodesRef]);

  useImperativeHandle(
    providedRef,
    () => inputRef.current as PromptHighlightTextInputHandle,
    [],
  );

  return (
    <MarkdownTextInput
      {...props}
      ref={inputRef}
      markdownStyle={promptMarkdownStyle}
      onBlur={handleBlur}
      onFocus={handleFocus}
      parser={promptMarkdownParser}
      textBreakStrategy="simple"
    />
  );
});
