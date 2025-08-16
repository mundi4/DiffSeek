import { AnchorFlags } from "@/core/EditorPairer";
import { TokenFlags } from "@/core/tokenization/types";

export function translateTokenFlagsToAnchorFlags(tokenFlags: number, endTokenFlags?: number): AnchorFlags {
	endTokenFlags ??= tokenFlags;
	let flags = 0;
	if (tokenFlags & TokenFlags.LINE_START) {
		flags |= AnchorFlags.LINE_START;
	}
	if (tokenFlags & TokenFlags.CONTAINER_START) {
		flags |= AnchorFlags.CONTAINER_START;
	}
	if (tokenFlags & TokenFlags.TABLE_START) {
		flags |= AnchorFlags.TABLE_START;
	}
	if (tokenFlags & TokenFlags.TABLEROW_START) {
		flags |= AnchorFlags.TABLEROW_START;
	}
	if (tokenFlags & TokenFlags.TABLECELL_START) {
		flags |= AnchorFlags.TABLECELL_START;
	}
	if (tokenFlags & TokenFlags.BLOCK_START) {
		flags |= AnchorFlags.BLOCK_START;
	}
	if (tokenFlags & TokenFlags.SECTION_HEADING_MASK) {
		// flags |= AnchorFlags.SECTION_HEADING;
	}
	return flags;
}
