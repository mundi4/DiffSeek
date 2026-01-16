/**
 * Default DiffOptions configuration
 * Shared between core and UI layers
 */
export function getDefaultDiffOptions(): DiffOptions {
	return {
		algorithm: "histogram",
		tokenization: "word",
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
		compareSupSub: true,
		compareImage: true,
		compareImageTolerance: 99,
	};
}
