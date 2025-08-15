// import { Button } from "@/components/ui/button";
// import { Copy, Check } from "lucide-react";
// import { cn } from "@/lib/utils";
// import { useState } from "react";

// interface CopyButtonProps {
//     getValue: () => string;
//     onCopied?: () => void;
//     className?: string;
//     "aria-label"?: string;
// }

// export function CopyButton({ getValue, onCopied, className, ...props }: CopyButtonProps) {
//     const [copied, setCopied] = useState(false);

//     const copy = async () => {
//         try {
//             await navigator.clipboard.writeText(getValue());
//             setCopied(true);
//             setTimeout(() => setCopied(false), 1000);
//             onCopied?.();
//         } catch {
//             // fail silently
//         }
//     };

//     return (
//         <Button
//             onClick={copy}
//             variant="default"
//             size="icon"
//             className={cn(
//                 "size-5 p-0 text-[0.75rem] font-mono font-bold rounded-[25%] shrink-0 select-none",
//                 className
//             )}
//             {...props}
//         >
//             {copied ? <Check className={cn("size-3")} /> : <Copy className={cn("size-3")} />}
//         </Button>
//     );
// }
