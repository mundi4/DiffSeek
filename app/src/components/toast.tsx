import clsx from "clsx";
import { useAtom } from "jotai";
import { useEffect } from "react";
import { toastAtom } from "../states/core-atoms";
import css from "./toast.module.css";

const AUTO_DISMISS_MS = 5000;

/**
 * 화면 상단 중앙 토스트.
 * - variant "loading": 스피너 표시, 자동 dismiss 없음 (변환 완료/실패 시 코드가 교체·해제)
 * - variant "error":   5초 자동 dismiss + 닫기 버튼
 * id가 바뀔 때마다 effect가 재실행되어 타이머가 리셋된다(연속 토스트 대응).
 */
export function Toast() {
	const [toast, setToast] = useAtom(toastAtom);

	useEffect(() => {
		if (!toast || toast.variant !== "error") return;
		const timer = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
		return () => clearTimeout(timer);
	}, [toast, setToast]);

	if (!toast) return null;

	const isError = toast.variant === "error";

	return (
		<div
			className={clsx(css.toast, isError ? css.error : css.loading)}
			role={isError ? "alert" : "status"}
			aria-live={isError ? "assertive" : "polite"}
		>
			{!isError && <span className={css.spinner} aria-hidden="true" />}
			<span className={css.message}>{toast.message}</span>
			{isError && (
				<button type="button" className={css.close} onClick={() => setToast(null)} aria-label="닫기">
					×
				</button>
			)}
		</div>
	);
}
