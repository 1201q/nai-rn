import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Keyboard } from "react-native";
import type { TagSuggestion } from "../lib/tagDb";

type SuggestionBarActions = {
  pickRef: React.MutableRefObject<((item: TagSuggestion) => void) | null>;
  setSuggestions: (s: TagSuggestion[], pick: (item: TagSuggestion) => void) => void;
  clearSuggestions: () => void;
};

const ActionsContext = createContext<SuggestionBarActions | null>(null);
const DataContext = createContext<TagSuggestion[]>([]);

export function SuggestionBarProvider({ children }: { children: ReactNode }) {
  const [suggestions, setSuggestionsState] = useState<TagSuggestion[]>([]);
  const pickRef = useRef<((item: TagSuggestion) => void) | null>(null);

  const setSuggestions = useCallback(
    (s: TagSuggestion[], pick: (item: TagSuggestion) => void) => {
      setSuggestionsState(s);
      pickRef.current = pick;
    },
    [],
  );

  const clearSuggestions = useCallback(() => {
    setSuggestionsState([]);
    pickRef.current = null;
  }, []);

  useEffect(() => {
    const subs = [
      Keyboard.addListener("keyboardWillHide", clearSuggestions),
      Keyboard.addListener("keyboardDidHide", clearSuggestions),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [clearSuggestions]);

  const actions = useMemo(
    () => ({ pickRef, setSuggestions, clearSuggestions }),
    [setSuggestions, clearSuggestions],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <DataContext.Provider value={suggestions}>
        {children}
      </DataContext.Provider>
    </ActionsContext.Provider>
  );
}

export function useSuggestionBarActions() {
  return useContext(ActionsContext);
}

export function useSuggestions() {
  return useContext(DataContext);
}
