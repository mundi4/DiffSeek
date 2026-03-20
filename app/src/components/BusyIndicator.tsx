import { useMinimumBusy } from "@/hooks/use-minimum-busy";
import { Loader } from "@mantine/core";

export function BusyIndicator({ busy }: { busy: boolean }) {
    const showLoader = useMinimumBusy(busy, 400);

    if (!showLoader) {
        return null;
    }

    return (
        <Loader size="xs" type="oval" />
    );
}