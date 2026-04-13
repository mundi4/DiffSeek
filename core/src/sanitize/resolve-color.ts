let ctx: OffscreenCanvasRenderingContext2D | null = null;

const reddishCache = new Map<string, boolean>([
	["red", true],
	["#ff0000", true],
	["#e60000", true],
	["#c00000", true],
	["rgb(255,0,0)", true],
	["rgb(230,0,0)", true],
	["#000000", false],
	["#333333", false],
	["#ffffff", false],
	["black", false],
	["blue", false],
	["white", false],
	["window", false],
	["windowtext", false],
]);

function getRGB(color: string): [number, number, number] | null {
	// #rrggbb
	const hex6 = /^#([0-9a-f]{6})$/i.exec(color);
	if (hex6) {
		const n = parseInt(hex6[1], 16);
		return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	}

	// #rgb
	const hex3 = /^#([0-9a-f]{3})$/i.exec(color);
	if (hex3) {
		const [r, g, b] = hex3[1].split("").map((c) => parseInt(c + c, 16));
		return [r, g, b];
	}

	// rgb(...) / rgba(...)
	const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
	if (rgb) {
		const parts = rgb[1].split(",").map((s) => parseInt(s.trim(), 10));
		if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
	}

	// fallback
	if (!ctx) {
		const canvas = new OffscreenCanvas(1, 1);
		ctx = canvas.getContext("2d", { willReadFrequently: true })!;
	}

	try {
		ctx.clearRect(0, 0, 1, 1);
		ctx.fillStyle = color;
		ctx.fillRect(0, 0, 1, 1);
		const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
		return [r, g, b];
	} catch {
		return null;
	}
}

function isReddish(color: string): boolean {
	let isRed = reddishCache.get(color);
	if (isRed !== undefined) return isRed;

	const rgb = getRGB(color);
	isRed = rgb ? rgb[0] >= 139 && rgb[0] - Math.max(rgb[1], rgb[2]) >= 65 : false;
	reddishCache.set(color, isRed);

	return isRed;
}

export function resolveColor(node: HTMLElement): "red" | "NORMAL" | null {
	let color: "red" | "NORMAL" | null = null;
	if ((node as HTMLElement).classList.contains("ds-color-red")) {
		color = "red";
	} else if ((node as HTMLElement).classList.contains("ds-color-normal")) {
		color = "NORMAL";
	} else {
		const colorValue = (node as HTMLElement).style?.color || "inherit";
		if (!colorValue || colorValue === "inherit") {
			return null;
		}
		if (isReddish(colorValue)) {
			color = "red";
		} else {
			color = "NORMAL";
		}
	}
	return color;
}
