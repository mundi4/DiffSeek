import { DiffListPanel } from "./DiffListPanel";
import { TrailViewPanel } from "./TrailViewPanel";
import { InlineDiffViewPanel } from "./InlineDiffViewPanel";
import { ResizablePanelGroup } from "../resizable/ResizablePanelGroup";
import { ResizablePanel } from "../resizable/ResizablePanel";
import clsx from "clsx";
import * as styles from "./AppSidebar.css";
import { FetishBar } from "../FetishBar";

export function AppSidebar() {
    return (
        <aside className={clsx(styles.root)}>
            <ResizablePanelGroup direction="vertical">
                <ResizablePanel initialSize="50%" minSize={25}>
                    <DiffListPanel />
                </ResizablePanel>
                <ResizablePanel initialSize="25%" minSize={25}>
                    <TrailViewPanel />
                </ResizablePanel>
                <ResizablePanel initialSize="25%" minSize={25}>
                    <InlineDiffViewPanel />
                </ResizablePanel>
            </ResizablePanelGroup>
            <FetishBar />
        </aside>
    );
}
