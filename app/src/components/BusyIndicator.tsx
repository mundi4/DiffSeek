import { useMinimumBusy } from "@/hooks/useDelayedBoolean";
import { Loader } from "@mantine/core";

export function BusyIndicator({ busy }: { busy: boolean }) {
    const showLoader = useMinimumBusy(busy, 500);

    if (!showLoader) {
        return null;
    }

    return (
        <Loader size="xs" type="oval" />
    );
}