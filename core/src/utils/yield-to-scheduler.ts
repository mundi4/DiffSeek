/**
 * `scheduler.yield()`로 메인 스레드/워커에 실행을 양보한다.
 *
 * `scheduler.yield`는 Chrome 129부터 기본 활성화됐다. 그 이전 버전(예: 12x 사내 환경)
 * 에서는 존재하지 않아 직접 호출하면 TypeError로 죽는다. 없으면 매크로태스크로 폴백한다.
 */
export function yieldToScheduler(): Promise<unknown> {
	const s = (globalThis as { scheduler?: { yield?: () => Promise<unknown> } }).scheduler;
	if (s?.yield) {
		return s.yield();
	}
	return new Promise((resolve) => setTimeout(resolve, 0));
}
