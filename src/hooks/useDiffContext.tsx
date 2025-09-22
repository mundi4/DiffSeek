import { useEffect, useState } from "react";
import { useDiffControllerContext } from "./useDiffController";
import type { DiffContext } from "@/core/DiffContext";

export function useDiffContext() {
    const { diffController: diffController } = useDiffControllerContext();
    const [ctx, setCtx] = useState(diffController.diffContext);
    useEffect(() => {
        const off = diffController.onDiffWorkflowDone((diffContext: DiffContext) => {
            setCtx(diffContext);
        });
        return off;
    }, [diffController]);

    return ctx;
}