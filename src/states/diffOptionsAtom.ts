import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { getDefaultDiffOptions } from "@/core/defaultDiffOptions";

export const diffOptionsAtom = atomWithStorage<DiffOptions>("diffOptions", getDefaultDiffOptions());

export const whitespaceHandlingAtom = atom<WhitespaceHandling, [WhitespaceHandling], void>(
	(get) => get(diffOptionsAtom).ignoreWhitespace,
	(get, set, value) => {
		const currentOptions = get(diffOptionsAtom);
		set(diffOptionsAtom, {
			...currentOptions,
			ignoreWhitespace: value as WhitespaceHandling,
		});
	}
);

export const compareImageAtom = atom<boolean, [boolean], void>(
	(get) => get(diffOptionsAtom).compareImage,
	(get, set, value) => {
		const currentOptions = get(diffOptionsAtom);
		set(diffOptionsAtom, {
			...currentOptions,
			compareImage: value,
		});
	}
);

export const compareImageToleranceAtom = atom<number, [number], void>(
	(get) => get(diffOptionsAtom).compareImageTolerance,
	(get, set, value) => {
		const currentOptions = get(diffOptionsAtom);
		set(diffOptionsAtom, {
			...currentOptions,
			compareImageTolerance: value,
		});
	}
);
