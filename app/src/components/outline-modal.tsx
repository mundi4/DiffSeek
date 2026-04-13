import { useT } from "@/i18n";
import { commonOutlineAtom } from "@/states/core-atoms";
import { useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import css from "./outline-modal.module.css";

export function OutlineModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
	const t = useT();
	const outline = useAtomValue(commonOutlineAtom);
	const dialogRef = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		if (opened && !dialog.open) {
			dialog.showModal();
		} else if (!opened && dialog.open) {
			dialog.close();
		}
	}, [opened]);

	return (
		<dialog ref={dialogRef} className={css.dialog} onClose={onClose}>
			<div className={css.header}>{t.outlineTitle}</div>
			<div className={css.body}>
				{outline.length === 0 ? (
					<div className={css.empty}>{t.outlineEmpty}</div>
				) : (
					<table className={css.table}>
						<thead>
							<tr>
								<th className={css.thIndex}>#</th>
								<th>{t.outlineLeft}</th>
								<th>{t.outlineRight}</th>
							</tr>
						</thead>
						<tbody>
							{outline.map((item) => (
								<tr key={`${item.leftTokenIndex}:${item.rightTokenIndex}:${item.index}`}>
									<td>{item.index + 1}</td>
									<td>
										<div className={css.cellStack}>
											<span className={css.cellText}>{item.leftLabel || t.outlineEmptyCell}</span>
											<div className={css.badgeGroup}>
												<span className={css.badge}>token {item.leftTokenIndex}</span>
											</div>
										</div>
									</td>
									<td>
										<div className={css.cellStack}>
											<span className={css.cellText}>
												{item.rightLabel || t.outlineEmptyCell}
											</span>
											<div className={css.badgeGroup}>
												<span className={css.badge}>token {item.rightTokenIndex}</span>
											</div>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</dialog>
	);
}
