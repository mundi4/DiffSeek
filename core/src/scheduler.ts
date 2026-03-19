export interface SchedulerOptions {
    signal?: AbortSignal;
    yieldInterval?: number;  // 2^n - 1 형태 (자동으로 가장 가까운 값으로 조정됨)
    minYieldIntervalMs?: number;  // 최소 yield 간격 (기본값: 16ms)
}

export class Scheduler {
    signal?: AbortSignal;
    private iterationCount = 0;
    private lastYieldTime = 0;
    private readonly yieldInterval: number;  // 2^n - 1 형태의 비트마스크
    private readonly minYieldIntervalMs: number;

    constructor(options: SchedulerOptions = {}) {
        this.signal = options.signal;
        this.yieldInterval = this.findNearestMask(options.yieldInterval ?? 0x7f);
        this.minYieldIntervalMs = options.minYieldIntervalMs ?? 16;
        this.lastYieldTime = performance.now();
    }

    /**
     * 가장 가까운 2^n - 1 형태의 비트마스크를 찾음
     */
    private findNearestMask(value: number): number {
        //if (value <= 0) return 0x7f;  // 기본값: 127 (2^7 - 1)

        // 의도적으로 0을 넣어서 yieldInterval 무시. 호출하는 쪽에서 직접 체크하고 싶을 때!
        if (value < 0) return 0;

        // 이미 2^n - 1 형태인지 확인 (비트연산으로)
        if (((value + 1) & value) === 0) {
            return value;
        }

        // 가장 높은 비트 위치 찾기
        const highestBit = Math.floor(Math.log2(value));

        // 두 후보값
        const lower = (1 << highestBit) - 1;          // 2^highestBit - 1
        const upper = (1 << (highestBit + 1)) - 1;    // 2^(highestBit + 1) - 1

        // 더 가까운 값 반환
        return (value - lower) <= (upper - value) ? lower : upper;
    }

    yield(): Promise<boolean> {
        this.iterationCount++;

        // iteration 조건 먼저 체크 (빠름)
        if ((this.iterationCount & this.yieldInterval) === 0) {
            // 시간 조건도 체크
            const now = performance.now();
            if (now - this.lastYieldTime >= this.minYieldIntervalMs) {
                this.lastYieldTime = now;
                return this.doYield();
            }
        }

        return Promise.resolve(false);
    }

    private async doYield(): Promise<boolean> {
        const g = globalThis as any;
        if (g.scheduler?.yield) {
            await g.scheduler.yield();
        } else {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        this.throwIfAborted();
        return true;
    }

    throwIfAborted(): void {
        this.signal?.throwIfAborted();
    }
}
