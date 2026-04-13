import type { HistogramAnchorScoreOptions, DiffScoreSystem } from "./types";

export function buildDiffScoreSystem(opt: HistogramAnchorScoreOptions = {}): DiffScoreSystem {
	const freqMax = opt.freqMax ?? 8;
	const freqGradeCount = opt.freqGradeCount ?? 4;
	const freqStride = freqMax + 1;

	const lenMax = opt.lenMax ?? 128;
	const lenGradeCount = opt.lenGradeCount ?? 8;

	const coreMaxScore = opt.coreMaxScore ?? 65535;

	const freqBase = (opt.freqBase ?? [64, 28, 12, 4]).slice(0, freqGradeCount);

	const lenBase = (opt.lenBase ?? [1, 2, 3, 5, 8, 12, 17, 24]).slice(0, lenGradeCount);

	const policyWeights = opt.policyWeights ?? [0, 0.05, 0.12];

	const positionalWeights = opt.positionalWeights ?? [0, 0.03, 0.07];

	// ---------- freq LUT ----------
	const freqPairGradeLUT = new Uint8Array(freqStride * freqStride);

	for (let a = 0; a <= freqMax; a++) {
		for (let b = 0; b <= freqMax; b++) {
			let min = a < b ? a : b;
			let max = a ^ b ^ min;

			let grade = freqGradeCount - 1;

			if (min === 1 && max === 1) grade = 0;
			else if (min === 1 && max <= 2) grade = 1;
			else if (min === 1 && max <= 4) grade = 2;
			else if (min === 2 && max === 2) grade = 1;
			else if (min === 2 && max <= 4) grade = 2;
			else if (min === 3 && max === 3) grade = 2;

			if (grade >= freqGradeCount) grade = freqGradeCount - 1;

			freqPairGradeLUT[a * freqStride + b] = grade;
		}
	}

	// ---------- len LUT (log2 기반) ----------
	const lenToGrade = new Uint8Array(lenMax + 1);

	for (let i = 0; i <= lenMax; i++) {
		if (i <= 1) {
			lenToGrade[i] = 0;
		} else {
			const g = 31 - Math.clz32(i);
			lenToGrade[i] = g >= lenGradeCount ? lenGradeCount - 1 : g;
		}
	}

	// ---------- core raw ----------
	const raw = new Uint32Array(freqGradeCount * lenGradeCount);

	let rawMax = 0;

	for (let f = 0; f < freqGradeCount; f++) {
		for (let l = 0; l < lenGradeCount; l++) {
			const v = freqBase[f] * lenBase[l];
			const idx = f * lenGradeCount + l;
			raw[idx] = v;
			if (v > rawMax) rawMax = v;
		}
	}

	// ---------- core normalize ----------
	const coreScoreTable = new Uint16Array(raw.length);

	const freqRowBase = new Uint16Array(freqGradeCount);

	for (let f = 0; f < freqGradeCount; f++) {
		const base = f * lenGradeCount;
		freqRowBase[f] = base;

		for (let l = 0; l < lenGradeCount; l++) {
			const idx = base + l;
			coreScoreTable[idx] = ((raw[idx] * coreMaxScore) / rawMax) | 0;
		}
	}

	// ---------- policy (coreMax 기준 비율) ----------
	const policyTable = new Uint16Array(policyWeights.length);

	for (let i = 0; i < policyWeights.length; i++) {
		policyTable[i] = Math.floor(policyWeights[i] * coreMaxScore);
	}

	// ---------- positional (multiplier) ----------
	const positionalMultipliers = new Float64Array(positionalWeights.length);

	for (let i = 0; i < positionalWeights.length; i++) {
		positionalMultipliers[i] = 1 + positionalWeights[i];
	}

	return {
		freqPairGradeLUT,
		freqStride,
		freqMax,
		freqGradeCount,
		freqRowBase,

		lenToGrade,
		lenMax,
		lenGradeCount,

		coreScoreTable,
		maxCoreScore: coreMaxScore,

		policyTable,
		positionalMultipliers,
		maxBonusMultiplier: positionalMultipliers[positionalMultipliers.length - 1],
	} satisfies DiffScoreSystem;
}
