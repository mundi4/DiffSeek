type IconProps = { size?: number; className?: string; style?: React.CSSProperties };

// Tabler Icons (MIT) — https://tabler.io/icons

export function CheckIcon({ size = 18, className, style }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			style={style}
		>
			<path d="M5 12l5 5l10 -10" />
		</svg>
	);
}

export function BookIcon({ size = 18, className, style }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			style={style}
		>
			<path d="M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
			<path d="M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0" />
			<path d="M3 6l0 13" />
			<path d="M12 6l0 13" />
			<path d="M21 6l0 13" />
		</svg>
	);
}

export function EqualIcon({ size = 18, className, style }: IconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			style={style}
		>
			<path d="M5 10h14" />
			<path d="M5 14h14" />
		</svg>
	);
}
