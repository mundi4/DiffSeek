import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const diffOptionsAtom = atomWithStorage<DiffOptions>("diffOptions", {
	algorithm: "histogram",
	tokenization: "word", // 이젠 안씀.
	ignoreWhitespace: "ignore",
	greedyMatch: false,
	useLengthBias: true,
	maxGram: 4,
	lengthBiasFactor: 0.7,
	containerStartMultiplier: 1 / 0.85,
	containerEndMultiplier: 1 / 0.9,
	sectionHeadingMultiplier: 1 / 0.9,
	lineStartMultiplier: 1 / 0.9,
	lineEndMultiplier: 1 / 0.95,
	uniqueMultiplier: 1 / 0.6667,
	compareSupSub: true, // 매뉴얼 등재 시 윗첨자 적용을 놓쳐서 창피한 일이 자주 생김...
	compareImage: true,
	compareImageTolerance: 99, // 이미지 픽셀 비교시에 어느정도나 일치해야 같은 이미지라고 판단할 지... %
});

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
