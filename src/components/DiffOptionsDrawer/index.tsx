import * as Dialog from "@radix-ui/react-dialog";
import { diffOptionsAtom } from "@/states/diffOptionsAtom";
import { useAtom } from "jotai";
import * as styles from "./DiffOptionsDrawer.css";
import { vars } from "@/styles/vars.css";
import { OptionsControls } from "./OptionsControls";
import { Button } from "../ui/button";
import { Settings } from "lucide-react";
import { settingsPanelOpenAtom } from "@/states/atoms";

export function DiffOptionsDrawer() {
  const [open, setOpen] = useAtom(settingsPanelOpenAtom);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          className={styles.triggerButton}
          variant="outline"
          size="xxs"
        >
          <Settings />
        </Button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.drawerContent}>
          <Dialog.Title>쓰잘 데 없는 설정</Dialog.Title>
          <div className={styles.contentBody}>
            <OptionsControls />
          </div>
          <div className={styles.footer}>
            <Dialog.Close asChild>
              <button className={styles.closeButton}>닫기</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
