import { atom } from "jotai";

export const diffOptionsAtom = atom<DiffOptions>({
	algorithm: "histogram",
	tokenization: "word",
	ignoreWhitespace: "ignore",
	greedyMatch: false,
	useLengthBias: true,
	maxGram: 4,
	lengthBiasFactor: 0.7,
	containerStartMultiplier: 1 / 0.85,
	containerEndMultiplier: 1 / 0.9,
	sectionHeadingMultiplier: 1 / 0.75,
	lineStartMultiplier: 1 / 0.9,
	lineEndMultiplier: 1 / 0.95,
	uniqueMultiplier: 1 / 0.6667,
	// 매뉴얼 등재 시 윗첨자 적용을 놓쳐서 창피한 일이 자주 생김...
	compareSupSub: true,
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
