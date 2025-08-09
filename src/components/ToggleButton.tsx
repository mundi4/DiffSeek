import { toggleButton } from "./ToggleButton.css";

interface ToggleButtonProps {
    checked: boolean;
    onChange: (value: boolean) => void;
    children?: React.ReactNode;
    disabled?: boolean;
    size?: "sm" | "md"; // ✅ 사이즈 지원
}

export function ToggleButton({
    checked,
    onChange,
    children,
    disabled = false,
    size = "md", // ✅ 기본값
}: ToggleButtonProps) {
    return (
        <button
            type="button"
            className={toggleButton({ checked, disabled, size })}
            onClick={() => !disabled && onChange(!checked)}
            aria-pressed={checked}
            disabled={disabled}
        >
            {children}
        </button>
    );
}

interface TriStateToggleButtonProps {
    values: [string, string, string]; // [primary, secondary, inactive]
    currentValue: string;
    onChange: (value: string) => void;
    children?: React.ReactNode;
    disabled?: boolean;
    size?: "sm" | "md";
}

export function TriStateToggleButton({
    values: [primary, secondary, inactive],
    currentValue,
    onChange,
    children,
    disabled = false,
    size = "md",
}: TriStateToggleButtonProps) {
    const getNextValue = () => {
        if (currentValue === primary) return secondary;
        if (currentValue === secondary) return inactive;
        return primary;
    };
    const checked = currentValue === primary ? true : currentValue === secondary ? "secondary" : false;
    return (
        <button
            type="button"
            className={toggleButton({ checked: checked, disabled, size })}
            onClick={() => !disabled && onChange(getNextValue())}
            aria-pressed={!!checked}
            disabled={disabled}
        >
            {children}
        </button>
    );
}