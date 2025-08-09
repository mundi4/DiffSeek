import { DiffListPanel } from "./DiffListPanel";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable"
import { cn } from "@/lib/utils";
import { TrailViewPanel } from "./TrailViewPanel";
import { InlineDiffViewPanel } from "./InlineDiffViewPanel";

export function AppSidebar() {
    return (
        <aside className={cn("flex flex-col w-full h-full min-h-0 bg-[#f3f4f6] border-l border-l-[#d1d5db]")}>
            <ResizablePanelGroup direction="vertical">
                <ResizablePanel >
                    <DiffListPanel />
                </ResizablePanel>

                <ResizableHandle />

                <ResizablePanel defaultSize={20} minSize={15} maxSize={50}>
                    <TrailViewPanel />
                </ResizablePanel>

                <ResizableHandle />

                <ResizablePanel defaultSize={20} minSize={15} maxSize={50}>
                    <InlineDiffViewPanel />
                </ResizablePanel>
            </ResizablePanelGroup>
        </aside>
    );
}
