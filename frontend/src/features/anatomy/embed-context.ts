import { createContext, useContext } from "react";

/**
 * Set when the anatomy workspace runs inside another page (a learning module's lab
 * pane). Links that would leave for another page call `onExit` instead, so the learner
 * stays where they are.
 */
export interface EmbedHost {
  /** Close the embedded workspace and return to the host page (optionally to an anchor). */
  onExit: (anchor?: string) => void;
}

export const EmbedContext = createContext<EmbedHost | null>(null);

export function useEmbedHost(): EmbedHost | null {
  return useContext(EmbedContext);
}
