import type { ko } from "./ko";

export type Messages = typeof ko;
export type MessageKey = keyof Messages;
export type Locale = "ko" | "en";
