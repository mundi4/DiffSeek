export type PanelPolicy = {
	minSize: number | string; // px | % (number는 px)
	initialSize?: number | string; // px | % (옵션)
	growWeight?: number; // default 1
	shrinkPriority?: number; // default 1 (낮을수록 먼저 줄임)
	shrinkWeight?: number; // default 1 (동일 priority 내 비례)
	lockAtMin?: boolean; // default false
	participatesInResize?: boolean; // default true
};

export type RegistryAPI = {
	register: (node: HTMLElement, policy: PanelPolicy) => number;
	update: (key: number, policy: Partial<PanelPolicy>) => void;
	unregister: (key: number) => void;
};
