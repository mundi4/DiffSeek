import { globalStyle, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const container = style({
	width: "100%",
	height: "100%",
	minWidth: 0,
	minHeight: 0,
});

export const grid = style([
	container,
	{
		display: "grid",
	},
]);

export const resizeHandle = recipe({
	base: {
		display: "grid",
		placeItems: "center",
		WebkitUserSelect: "none",
		userSelect: "none",
	},
	variants: {
		direction: {
			horizontal: {
				cursor: "col-resize",
				width: "var(--handle-size, 4px)",
			},
			vertical: {
				cursor: "row-resize",
				height: "var(--handle-size, 4px)",
			},
		},
		disabled: {
			true: {
				cursor: "not-allowed !important",
			},
		},
	},
});

globalStyle(`${resizeHandle.classNames.variants.direction.horizontal} div`, {
	height: "100%",
	width: 1,
});

globalStyle(`.${resizeHandle.classNames.variants.direction.vertical} div`, {
	width: "100%",
	height: 1,
});

export const panel = style({
	minHeight: 0,
	minWidth: 0,
	overflow: "hidden",
});
