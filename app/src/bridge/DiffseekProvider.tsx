// bridge/index.tsx
import { createContext, useContext, type ReactNode } from 'react';
import { useCoreBinding } from './useCoreBinding';
import { useCoreActions } from './useCoreActions';
import type { DiffseekActions } from './types';
import type { DiffseekEngine } from '@core/DiffseekEngine';

const ActionsContext = createContext<DiffseekActions | null>(null);

export function DiffseekProvider({
    engine,
    children
}: {
    engine: DiffseekEngine;
    children: ReactNode
}) {
    // 1. 단방향 바인딩 실행 (Core -> State)
    useCoreBinding({ engine });

    // 2. 액션 객체 생성 (UI -> Core)
    const actions = useCoreActions({ engine });

    return (
        <ActionsContext.Provider value={actions} >
            {children}
        </ActionsContext.Provider>
    );
}

// 컴포넌트에서 편하게 쓸 커스텀 훅
export const useDiffseekActions = () => {
    const ctx = useContext(ActionsContext);
    if (!ctx) throw new Error("DiffseekProvider is not found in the component tree.");
    return ctx;
};