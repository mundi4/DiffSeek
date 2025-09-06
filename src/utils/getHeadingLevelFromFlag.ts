import { TokenFlags } from "@/core/tokenization/TokenFlags";

export function getHeadingLevelFromFlag(flag: number): number {
	switch (flag) {
		case TokenFlags.SECTION_HEADING_TYPE1:
			return 0; // 1.
		case TokenFlags.SECTION_HEADING_TYPE2:
			return 1; // 가.
		case TokenFlags.SECTION_HEADING_TYPE3:
			return 2; // (1)
		case TokenFlags.SECTION_HEADING_TYPE4:
			return 3; // (가)
		case TokenFlags.SECTION_HEADING_TYPE5:
			return 4; // 1)
		case TokenFlags.SECTION_HEADING_TYPE6:
			return 5; // 가)
		default:
			return -1;
	}
}
