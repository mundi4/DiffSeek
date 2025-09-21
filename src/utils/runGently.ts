// runGently.ts
export interface GentlyCtx {
    cancelled: boolean;
    cancel(): void;
}

export function runGently<T extends GentlyCtx>(
    makeGen: (ctx: T) => Generator<any, void, IdleDeadline>,
    ctx: T
): Promise<T> {
    const gen = makeGen(ctx);

    let deadline: IdleDeadline = {
        timeRemaining: () => Infinity,
        didTimeout: false,
    };

    function step(nextVal?: any): Promise<void> {
        if (ctx.cancelled) {
            return Promise.reject(new Error("cancelled"));
        }

        const { value, done } = gen.next(nextVal);
        if (done) return Promise.resolve();

        // idle split
        if (value === undefined) {
            return new Promise<void>((resolve) => {
                requestIdleCallback((d) => {
                    deadline = d;
                    step(deadline).then(resolve, resolve);
                });
            });
        }

        // Promise yield
        if (value instanceof Promise) {
            return value.then(
                (res) => step(res),
                (err) => Promise.reject(err)
            );
        }

        // deadline 직접 전달
        return step(value);
    }

    return step().then(() => ctx);
}
