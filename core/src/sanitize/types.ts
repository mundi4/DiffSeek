export type DingbatFont = "wingdings" | "wingdings 2" | "wingdings 3" | "symbol";

export type ElementPolicy = {
	allowedAttrs?: Record<string, boolean>;
	allowedStyles?: Record<string, boolean>;
	replaceTag?: string;
	exclude?: boolean;
};
