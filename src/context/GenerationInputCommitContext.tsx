import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

type RegisterPendingCommit = (commit: () => void) => () => void;

type GenerationInputCommitContextValue = {
  registerPendingCommit: RegisterPendingCommit;
  commitPendingInput: () => void;
};

const NOOP_CONTEXT: GenerationInputCommitContextValue = {
  registerPendingCommit: () => () => {},
  commitPendingInput: () => {},
};

const GenerationInputCommitContext =
  createContext<GenerationInputCommitContextValue>(NOOP_CONTEXT);

export function GenerationInputCommitProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pendingRef = useRef<{
    token: symbol;
    commit: () => void;
  } | null>(null);

  const registerPendingCommit = useCallback<RegisterPendingCommit>((commit) => {
    const token = Symbol("generation-input-commit");
    pendingRef.current = { token, commit };

    return () => {
      if (pendingRef.current?.token === token) pendingRef.current = null;
    };
  }, []);

  const commitPendingInput = useCallback(() => {
    pendingRef.current?.commit();
  }, []);

  const value = useMemo(
    () => ({ registerPendingCommit, commitPendingInput }),
    [commitPendingInput, registerPendingCommit],
  );

  return (
    <GenerationInputCommitContext.Provider value={value}>
      {children}
    </GenerationInputCommitContext.Provider>
  );
}

export function useGenerationInputCommit() {
  return useContext(GenerationInputCommitContext);
}

export function useGenerationInputCommitRegistration(commit: () => void) {
  const { registerPendingCommit } = useGenerationInputCommit();
  const commitRef = useRef(commit);
  const unregisterRef = useRef<(() => void) | null>(null);
  commitRef.current = commit;

  const activate = useCallback(() => {
    unregisterRef.current?.();
    unregisterRef.current = registerPendingCommit(() => commitRef.current());
  }, [registerPendingCommit]);

  const commitAndDeactivate = useCallback(() => {
    commitRef.current();
    unregisterRef.current?.();
    unregisterRef.current = null;
  }, []);

  useEffect(
    () => () => {
      unregisterRef.current?.();
      unregisterRef.current = null;
    },
    [],
  );

  return { activate, commitAndDeactivate };
}
