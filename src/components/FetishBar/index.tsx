import { useAtom } from "jotai";
import { BookOpen, EqualApproximately, Space, WrapText } from 'lucide-react';
import { whitespaceHandlingAtom } from '@/states/diffOptionsAtom';
import * as styles from './FetishBar.css';
import clsx from "clsx";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { Toggle } from "../ui/toggle";
import { syncModeAtom } from "@/states/atoms";
import { useCallback } from "react";

interface FetishBarProps {
}

// TODO overflow menu?
export function FetishBar({ }: FetishBarProps) {
    const [syncMode, setSyncMode] = useAtom(syncModeAtom);
    const [whitespaceHandling, setWhitespaceHandling] = useAtom(whitespaceHandlingAtom);
    return (
        <div className={clsx(styles.root)} style={{
            // "--accent": "var(--primary)",
            // "--accent-foreground": "var(--primary-foreground)"

        } as any}>
            <div className={clsx(styles.buttons)}>
                <Toggle pressed={syncMode} onPressedChange={setSyncMode} size="xs"><BookOpen /></Toggle>
            </div>
            <div className={clsx(styles.rightButtons)}>
                <ModeSelector value={whitespaceHandling} onChange={(v) => setWhitespaceHandling(v)} />
                {/* <Toggle size="sm" variant="outline" pressed={syncMode} onPressedChange={setSyncMode}><BookOpen size={14} /></Toggle> */}

            </div>
        </div>
    );
}

type Mode = "ignore" | "onlyAtEdge" | "normalize";

interface ModeSelectorProps {
    value: Mode;
    onChange: (value: Mode) => void;
}

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
    const onValueChange = useCallback((v: Mode) => v && onChange(v), [onChange]);

    return (
        <ToggleGroup variant="default" type="single" size="xs" value={value} onValueChange={onValueChange} className="" style={{
            "--accent": "var(--primary)",
            "--accent-foreground": "var(--primary-foreground)"

        } as any}>
            <ToggleGroupItem value="ignore" aria-label="Ignore whitespace" title="Ignore whitespace">
                <EqualApproximately size={14} />
            </ToggleGroupItem>
            <ToggleGroupItem value="onlyAtEdge" aria-label="Ignore whitespace only at edge" title="Ignore whitespace only at edge">
                <WrapText size={14} />
            </ToggleGroupItem>
            <ToggleGroupItem value="normalize" aria-label="Normalize whitespace" title="Normalize whitespace">
                <Space size={14} />
            </ToggleGroupItem>
        </ToggleGroup>
    );
}