import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { assignInlineVars } from '@vanilla-extract/dynamic';
import clsx from "clsx";
import * as styles from "./Button.css";

type ButtonVariant = keyof typeof styles.variant;
type ButtonSize = keyof typeof styles.size;

export type ButtonProps = React.ComponentProps<"button"> & {
	asChild?: boolean;
	variant?: ButtonVariant;
	size?: ButtonSize;
	/** 임의 색상 지정 (hex, rgb, hsl 등 유효한 CSS color) */
	color?: string;
	surface?: string;
	px?: string | number;
	borderStrength?: string | number;
	height?: string | number;
};

export function Button({
	className,
	variant = "default",
	size = "md",
	asChild = false,
	color,
	surface,
	px,
	borderStrength,
	height,
	style,
	...props
}: ButtonProps) {
	const Comp = asChild ? Slot : "button";

	// CSS 변수로 색 주입. 없으면 vars에서 준 기본값 사용됨.
	// const styleVars = color
	// 	? ({ ["--btn-color" as any]: color } as React.CSSProperties)
	// 	: undefined;

	const styleVars = assignInlineVars({
		[styles.buttonColor]: color,
		[styles.buttonSurface]: surface,
		[styles.buttonPaddingInline]: typeof px === "number" ? `${px}px` : px,
		[styles.buttonBorderStrength]: typeof borderStrength === "number" ? `${borderStrength}%` : borderStrength,
		[styles.buttonHeight]: typeof height === "number" ? `${height}px` : height
	});

	return (
		<Comp
			data-slot="button"
			className={clsx(styles.button, styles.variant[variant], styles.size[size], className)}
			style={styleVars ? { ...styleVars, ...style, } : style}
			{...props}
		/>
	);
}
