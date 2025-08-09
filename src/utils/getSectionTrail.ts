export function getSectionHeadingTrail(sectionRoots: SectionHeading[], tokenIndex: number): SectionHeading[] {
	const deepest = findDeepestSectionHeading(sectionRoots, tokenIndex);
	if (!deepest) return [];
	const trail = buildSectionTrail(deepest);
	return trail;
}

export function getSectionTrailText(sectionRoots: SectionHeading[], tokenIndex: number) {
	const trail = getSectionHeadingTrail(sectionRoots, tokenIndex);
	let result = "";
	for (let i = 0; i < trail.length; i++) {
		const heading = trail[i];
		if (i > 0) result += " > "; // 구분자
		result += heading.title;
	}
	return result;
}

function findDeepestSectionHeading(sectionRoots: SectionHeading[], tokenIndex: number): SectionHeading | null {
	let result: SectionHeading | null = null;

	function search(node: SectionHeading) {
		if (tokenIndex < node.startTokenIndex || tokenIndex >= node.endTokenIndex) return;
		result = node;

		let child = node.firstChild;
		while (child) {
			search(child);
			child = child.nextSibling;
		}
	}

	for (const root of sectionRoots) {
		search(root);
	}

	return result;
}

function buildSectionTrail(heading: SectionHeading): SectionHeading[] {
	const trail: SectionHeading[] = [];

	let current: SectionHeading | null = heading;
	while (current) {
		trail.unshift(current); // 루트부터 순서대로 되도록 unshift
		current = current.parent;
	}

	return trail;
}
