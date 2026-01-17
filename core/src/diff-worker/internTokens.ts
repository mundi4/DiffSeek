import { calculateHash, isSame, isSameCross } from "./helpers";

const HASH_SIZE = 0xFFFFF + 1;
const HEAD = new Int32Array(HASH_SIZE);

export function internTokenTexts(
    lhs: { buf: Uint16Array, off: Uint32Array },
    rhs: { buf: Uint16Array, off: Uint32Array }
): {
    combinedIds: Int32Array,
    idLhs: Int32Array,
    idRhs: Int32Array,
    pivot: number,
    lMin: number, lMax: number,
    rMin: number, rMax: number
} {
    const numLhs = lhs.off.length - 1;
    const numRhs = rhs.off.length - 1;
    const pivot = numLhs; // 세퍼레이터 위치 (LHS 직후)

    // 1. 단일 메모리 할당 (LHS + SEP + RHS)
    const combinedIds = new Int32Array(numLhs + 1 + numRhs);
    const idLhs = combinedIds.subarray(0, numLhs);
    const idRhs = combinedIds.subarray(pivot + 1);

    // 2. 링크드 리스트용 보조 배열 (HEAD 전역 사용으로 메모리 절약)
    const nextLhs = new Int32Array(numLhs).fill(-1);
    const nextRhs = new Int32Array(numRhs).fill(-1);

    HEAD.fill(-1);
    let nextId = 1;

    // --- 3. LHS 처리 ---
    for (let i = 0; i < numLhs; i++) {
        const offStart = lhs.off[i];
        const len = lhs.off[i + 1] - offStart;
        const h = calculateHash(lhs.buf, offStart, len) & 0xFFFFF;
        let matchIdx = -1;

        for (let curr = HEAD[h]; curr !== -1; curr = nextLhs[curr]) {
            if (isSame(lhs.buf, lhs.off, curr, i)) {
                matchIdx = curr;
                break;
            }
        }

        if (matchIdx === -1) {
            idLhs[i] = nextId++;
            nextLhs[i] = HEAD[h];
            HEAD[h] = i;
        } else {
            idLhs[i] = idLhs[matchIdx];
        }
    }
    const lMin = numLhs > 0 ? 1 : 0;
    const lMax = nextId - 1;

    // --- 4. 세퍼레이터 삽입 ---
    // LHS의 어떤 ID와도 겹치지 않는 벽(Wall) 세우기
    // 0을 넣을까?
    combinedIds[pivot] = nextId++;

    // --- 5. RHS 처리 ---
    let rMin = 0x7FFFFFFF;
    let rMax = 0;

    for (let i = 0; i < numRhs; i++) {
        const offStart = rhs.off[i];
        const len = rhs.off[i + 1] - offStart;
        const h = calculateHash(rhs.buf, offStart, len) & 0xFFFFF;
        let foundId = -1;
        let curr = HEAD[h];

        while (curr !== -1) {
            if (curr < numLhs) { // LHS 쪽에 같은 텍스트가 있는지 확인
                if (isSameCross(rhs.buf, rhs.off, i, lhs.buf, lhs.off, curr)) {
                    foundId = idLhs[curr];
                    break;
                }
                curr = nextLhs[curr];
            } else { // 이미 등록된 RHS 쪽에 같은 텍스트가 있는지 확인
                const prevRhsIdx = curr - numLhs;
                if (isSame(rhs.buf, rhs.off, i, prevRhsIdx)) {
                    foundId = idRhs[prevRhsIdx];
                    break;
                }
                curr = nextRhs[prevRhsIdx];
            }
        }

        if (foundId !== -1) {
            idRhs[i] = foundId;
        } else {
            foundId = nextId++;
            idRhs[i] = foundId;
            nextRhs[i] = HEAD[h];
            HEAD[h] = i + numLhs;
        }

        // rMin, rMax 트래킹
        if (foundId < rMin) rMin = foundId;
        if (foundId > rMax) rMax = foundId;
    }

    // RHS가 비어있는 경우 rMin 보정
    if (numRhs === 0) rMin = 0;

    return { combinedIds, idLhs, idRhs, pivot, lMin, lMax, rMin, rMax };
}

// export function internTokenTexts(
//     lhs: { buf: Uint16Array, off: Uint32Array },
//     rhs: { buf: Uint16Array, off: Uint32Array }
// ): {
//     idLhs: Int32Array, idRhs: Int32Array,
//     lMin: number, lMax: number,
//     rMin: number, rMax: number
// } {
//     const numLhs = lhs.off.length - 1;
//     const numRhs = rhs.off.length - 1;

//     const idLhs = new Int32Array(numLhs);
//     const nextLhs = new Int32Array(numLhs).fill(-1);
//     const idRhs = new Int32Array(numRhs);
//     const nextRhs = new Int32Array(numRhs).fill(-1);

//     HEAD.fill(-1);
//     let nextId = 1;

//     // 1. LHS 처리: 비교 연산 0회 전략
//     if (numLhs > 0) {
//         for (let i = 0; i < numLhs; i++) {
//             const offStart = lhs.off[i];
//             const len = lhs.off[i + 1] - offStart;
//             const h = calculateHash(lhs.buf, offStart, len) & 0xFFFFF;
//             let matchIdx = -1;

//             for (let curr = HEAD[h]; curr !== -1; curr = nextLhs[curr]) {
//                 if (isSame(lhs.buf, lhs.off, curr, i)) {
//                     matchIdx = curr;
//                     break;
//                 }
//             }

//             if (matchIdx === -1) {
//                 idLhs[i] = nextId++;
//                 nextLhs[i] = HEAD[h];
//                 HEAD[h] = i;
//             } else {
//                 idLhs[i] = idLhs[matchIdx];
//             }
//         }
//     }
//     const lMin = numLhs > 0 ? 1 : 0;
//     const lMax = nextId - 1;

//     // 2. RHS 처리: 비교 최소화 전략
//     let rMin = 0, rMax = 0;
//     if (numRhs > 0) {
//         // 첫 번째 루프를 밖으로 빼서 rMin, rMax 초기화 (Infinity 비교 제거)
//         // ... (첫 번째 i=0 로직 생략, 실제 구현 시엔 중복 제거를 위해 함수화하거나 첫 루프만 특수 처리)

//         rMin = 0x7FFFFFFF; // Max Int32
//         for (let i = 0; i < numRhs; i++) {
//             const offStart = rhs.off[i];
//             const len = rhs.off[i + 1] - offStart;
//             const h = calculateHash(rhs.buf, offStart, len) & 0xFFFFF;
//             let foundId = -1;
//             let curr = HEAD[h];

//             while (curr !== -1) {
//                 if (curr < numLhs) {
//                     if (isSameCross(rhs.buf, rhs.off, i, lhs.buf, lhs.off, curr)) {
//                         foundId = idLhs[curr];
//                         break;
//                     }
//                     curr = nextLhs[curr];
//                 } else {
//                     const prevRhsIdx = curr - numLhs;
//                     if (isSame(rhs.buf, rhs.off, i, prevRhsIdx)) {
//                         foundId = idRhs[prevRhsIdx];
//                         break;
//                     }
//                     curr = nextRhs[prevRhsIdx];
//                 }
//             }

//             if (foundId !== -1) {
//                 idRhs[i] = foundId;
//                 if (foundId < rMin) rMin = foundId;
//                 if (foundId > rMax) rMax = foundId;
//             } else {
//                 const newId = nextId++;
//                 idRhs[i] = newId;
//                 nextRhs[i] = HEAD[h];
//                 HEAD[h] = i + numLhs;

//                 // 새 ID는 항상 기존 max보다 크므로 비교 없이 대입
//                 if (newId < rMin) rMin = newId;
//                 rMax = newId;
//             }
//         }
//     }

//     return { idLhs, idRhs, lMin, lMax, rMin, rMax };
// }