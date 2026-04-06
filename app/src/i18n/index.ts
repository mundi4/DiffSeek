import { atom, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { en } from "./en";
import { ko } from "./ko";
import type { Locale, Messages } from "./types";

export type { Locale, Messages } from "./types";

const bundles: Record<Locale, Messages> = { ko, en };

export const localeAtom = atomWithStorage<Locale>("diffseek_locale", "ko");

export const messagesAtom = atom<Messages>((get) => bundles[get(localeAtom)]);

export function useT(): Messages {
    return useAtomValue(messagesAtom);
}
