import {
  MarkdownTextInput,
  type MarkdownRange,
  type MarkdownStyle,
  type MarkdownTextInputProps,
} from "@expensify/react-native-live-markdown";
import { forwardRef, type ComponentRef } from "react";

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
  link: {
    color: "#2f9e44",
  },
};

function promptMarkdownParser(input: string): MarkdownRange[] {
  "worklet";

  const ranges: MarkdownRange[] = [];
  const spans = parsePromptHighlights(input);
  let start = 0;

  for (const span of spans) {
    let type: MarkdownRange["type"] | undefined;

    if (span.weight !== undefined && Math.abs(span.weight - 1) > 0.0001) {
      type = span.weight < 1 ? "mention-here" : "mention-user";
    } else if (span.kind === "numericMark") {
      type = "mention-report";
    } else if (span.kind === "randomizer") {
      type = "link";
    } else if (span.kind === "bracket" || span.kind === "separator") {
      type = "syntax";
    }

    if (type !== undefined) {
      ranges.push({ type, start, length: span.text.length });
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
>;

export const PromptHighlightTextInput = forwardRef<
  PromptHighlightTextInputHandle,
  PromptHighlightTextInputProps
>(function PromptHighlightTextInput(props, ref) {
  return (
    <MarkdownTextInput
      {...props}
      ref={ref}
      markdownStyle={promptMarkdownStyle}
      parser={promptMarkdownParser}
    />
  );
});
