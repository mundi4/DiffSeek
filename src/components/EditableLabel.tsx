import { useState, useRef, useEffect } from "react";
import { input, label, placeholder } from "./EditableLabel .css";
import clsx from "clsx";

interface EditableLabelProps {
    value: string;
    onCommit: (newValue: string) => void;
    onCancel?: () => void;
    className?: string;
}

export function EditableLabel({
    value,
    onCommit,
    onCancel,
    className = "",
}: EditableLabelProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editing) {
            setDraft(value);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [editing, value]);

    const commit = () => {
        const trimmed = draft.trim();
        if (trimmed !== value) onCommit(trimmed);
        setEditing(false);
    };

    const cancel = () => {
        onCancel?.();
        setEditing(false);
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={cancel}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        commit();
                    } else if (e.key === "Escape") {
                        e.preventDefault();
                        cancel();
                    }
                }}
                className={clsx(input, className)}
            />
        );
    }

    return (
        <span
            onDoubleClick={() => setEditing(true)}
            className={clsx(label, className)}
        >
            {value || <span className={placeholder}>empty</span>}
        </span>
    );
}
