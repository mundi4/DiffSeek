// import type { JSX } from "preact/jsx-runtime";


// export type SideTagButtonProps = preact.HTMLAttributes<HTMLButtonElement> & {
//     side: "left" | "right";
//     visible?: boolean;
//     // background?: string;           // e.g. "220 60% 55%"
//     // foreground?: string;           // e.g. "0 0% 100%"
//     // border?: string;               // e.g. "0 0% 35%"
//     "aria-label"?: string;
//     onClick?: (ev: preact.TargetedMouseEvent<HTMLButtonElement>) => void;
// };

// export function SideTagButton({
//     side,
//     visible = true,
//     onClick,
//     // background,
//     // foreground,
//     // border,
//     "aria-label": ariaLabel,
//     ...props
// }: SideTagButtonProps) {

//     return (
//         <button
//             type="button"
//             onClick={onClick}
//             aria-label={ariaLabel}
//             className={`side-tag-button side-tag-button--${side} ${visible ? 'side-tag-button--visible' : 'side-tag-button--hidden'}`}
//             //style={style}

//             {...props}
//         >
//             {side === "left" ? <span>L</span> : <span>R</span>}
//         </button>
//     );
// }