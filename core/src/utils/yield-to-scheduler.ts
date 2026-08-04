/**
 * `scheduler.yield()`로 메인 스레드/워커에 실행을 양보한다.
 *
 * `scheduler.yield`는 Chrome 129부터 기본 활성화됐다. 그 이전 버전(예: 12x 사내 환경)과
 * 비 Chromium(Safari 등)에는 존재하지 않아 직접 호출하면 TypeError로 죽는다.
 *
 * 폴백으로 `setTimeout(0)`을 쓰면 안 된다 — HTML 명세상 중첩 타이머는 4ms로 클램프되므로
 * 양보 1회당 4ms가 붙는다. 토큰화처럼 양보를 자주 하는 경로에서는 이것만으로 수 초가 된다.
 * MessageChannel은 클램프 없이 매크로태스크 한 턴만 양보한다.
 */

let channel: MessageChannel | undefined;
let channelBroken = false;
const waiters: Array<() => void> = [];

function yieldViaMessageChannel(): Promise<void> {
	let ch = channel;
	if (!ch) {
		ch = channel = new MessageChannel();
		ch.port1.onmessage = () => {
			waiters.shift()?.();
		};
		ch.port1.start();
	}
	const port = ch.port2;
	return new Promise<void>((resolve) => {
		waiters.push(resolve);
		port.postMessage(null);
	});
}

export function yieldToScheduler(): Promise<unknown> {
	const s = (globalThis as { scheduler?: { yield?: () => Promise<unknown> } }).scheduler;
	if (s?.yield) {
		return s.yield();
	}

	if (!channelBroken && typeof MessageChannel === "function") {
		try {
			return yieldViaMessageChannel();
		} catch {
			channelBroken = true;
		}
	}

	return new Promise((resolve) => setTimeout(resolve, 0));
}
