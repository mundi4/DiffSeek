import React from "react";
import { cn } from "@/lib/utils";
import { SideCopyButton } from "../SideCopyButton";

interface TrailItem {
    ordinalText: string;
    title: string;
}

interface TrailProps {
    side: "left" | "right";
    trail: TrailItem[];
}

function getTrailText(trail: TrailItem[]) {
    return trail.map((h) => `${h.ordinalText} ${h.title}`).join(" › ");
}

function Trail({ side, trail }: TrailProps) {
    const getValue = () => getTrailText(trail);
    return (
        <div className={cn("flex items-start gap-1.5 p-1")}>
            <SideCopyButton getValue={getValue} side={side} />
            <dl className={cn("m-0 text-sm")}>
                {trail.map((h, i) => (
                    <React.Fragment key={i}>
                        <dt className={cn("inline font-bold text-accent-foreground")}>{h.ordinalText}</dt>
                        <dd className={cn("inline")}>
                            {" "}
                            {h.title}
                            {i < trail.length - 1 && <span className={cn("mx-1 text-muted-foreground")}> › </span>}
                        </dd>
                    </React.Fragment>
                ))}
            </dl>
        </div>
    );
}

type SectionTrailProps = React.HTMLAttributes<HTMLDivElement> & {
    leftTrail: SectionHeading[];
    rightTrail: SectionHeading[];
}

export function SectionTrail({ leftTrail, rightTrail, className }: SectionTrailProps) {
    if (leftTrail.length === 0 && rightTrail.length === 0) return null;
    return (
        <div className={cn(className)}>
            <Trail trail={leftTrail} side="left" />
            <Trail trail={rightTrail} side="right" />
        </div>
    );
}