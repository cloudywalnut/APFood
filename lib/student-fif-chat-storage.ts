// Student FIF chat history, kept in session storage: per browser tab, per signed-in student,
// and removed on sign-out. Kept outside the chat component so sign-out code can clear it without a cycle.
import type { StudentCartAction } from "./backend/contracts";
export type StudentFifMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  links?: { href: string; label: string }[];
  cartAction?: StudentCartAction;
  actionState?: "added" | "failed";
};

const chatStoragePrefix = "ap-food-student-fif-chat:";
export const chatStorageKey = (userId: string) => chatStoragePrefix + userId;

// Removes saved student chats from this tab, except the given student's. Called on sign-out and when
// a different account (or a guest) uses the tab, so one person's conversation never lingers for the next.
export function clearStudentFifChats(keepUserId?: string) {
  try {
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(chatStoragePrefix) && key !== (keepUserId && chatStorageKey(keepUserId)))
        sessionStorage.removeItem(key);
    }
  } catch {
    /* Storage unavailable; nothing was saved. */
  }
}
export const maxStoredMessages = 60;

export function readStoredChat(userId: string): StudentFifMessage[] | undefined {
  try {
    const raw = sessionStorage.getItem(chatStorageKey(userId));
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return undefined;
    const valid = parsed.filter(
      (entry): entry is StudentFifMessage =>
        typeof entry === "object" &&
        entry !== null &&
        typeof entry.id === "string" &&
        (entry.role === "assistant" || entry.role === "user") &&
        typeof entry.text === "string" &&
        (entry.links === undefined ||
          (Array.isArray(entry.links) &&
            entry.links.every(
              (link: unknown) =>
                typeof link === "object" &&
                link !== null &&
                typeof (link as { href?: unknown }).href === "string" &&
                (link as { href: string }).href.startsWith("/") &&
                !(link as { href: string }).href.startsWith("//") &&
                typeof (link as { label?: unknown }).label === "string",
            ))),
    );
    return valid.length ? valid : undefined;
  } catch {
    return undefined;
  }
}
