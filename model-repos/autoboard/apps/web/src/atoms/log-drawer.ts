import { atom, createStore } from "jotai";
import { updateCard } from "~/api/cards";
import { runCard } from "~/api/run-card";

export const store = createStore();

export const selectedCardIdAtom = atom<string | null>(null);
export const selectedCardTitleAtom = atom<string | undefined>(undefined);
export const selectedCardDescriptionAtom = atom<string | undefined>(undefined);
export const drawerKeyAtom = atom(0);

const refetchCardsRef = { current: undefined as (() => void) | undefined };

export function registerRefetch(fn: (() => void) | undefined) {
  refetchCardsRef.current = fn ?? undefined;
}

export function getRefetch() {
  return refetchCardsRef.current;
}

export function openDrawer(
  cardId: string,
  title?: string,
  description?: string
) {
  store.set(selectedCardIdAtom, cardId);
  store.set(selectedCardTitleAtom, title);
  store.set(selectedCardDescriptionAtom, description);
}

export function closeDrawer() {
  store.set(selectedCardIdAtom, null);
}

export async function sendFollowUp(cardId: string, prompt: string) {
  try {
    await updateCard(cardId, { columnId: "in-progress" });
    await runCard({ cardId, prompt });
    store.set(drawerKeyAtom, (k) => k + 1);
    refetchCardsRef.current?.();
  } catch (error) {
    console.error("Error sending follow-up:", error);
    alert("Failed to send follow-up. Please try again.");
  }
}

export function handleRunComplete() {
  refetchCardsRef.current?.();
}
