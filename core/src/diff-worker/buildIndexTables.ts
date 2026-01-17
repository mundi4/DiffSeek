export function buildIndexTables(combinedIds: Int32Array, maxId: number, pivot: number) {
    const n = combinedIds.length;
    let sa = new Int32Array(n);
    let rank = new Int32Array(n);
    let tmp = new Int32Array(n);

    for (let i = 0; i < n; i++) {
        sa[i] = i;
        rank[i] = combinedIds[i];
    }

    sa.sort((a, b) => combinedIds[a] - combinedIds[b]);

    // 1. SA & Rank 구축 (Prefix Doubling)
    for (let k = 1; k < n; k <<= 1) {
        const compare = (i: number, j: number) => {
            if (rank[i] !== rank[j]) return rank[i] - rank[j];
            const ri = i + k < n ? rank[i + k] : -1;
            const rj = j + k < n ? rank[j + k] : -1;
            return ri - rj;
        };

        sa.sort(compare);

        tmp[sa[0]] = 0;
        for (let i = 1; i < n; i++) {
            tmp[sa[i]] = tmp[sa[i - 1]] + (compare(sa[i - 1], sa[i]) < 0 ? 1 : 0);
        }

        let swap = rank;
        rank = tmp;
        tmp = swap;

        if (rank[sa[n - 1]] === n - 1) break;
    }

    // --- 2. Prefix Sum 구축 (추가된 로직) ---
    // SA의 각 인덱스까지 LHS(pos < pivot)와 RHS(pos > pivot)의 개수를 누적
    // const lhsPrefixSum = new Int32Array(n + 1);
    // const rhsPrefixSum = new Int32Array(n + 1);
    // let lAcc = 0;
    // let rAcc = 0;

    // for (let i = 0; i < n; i++) {
    //     const pos = sa[i];
    //     if (pos < pivot) {
    //         lAcc++;
    //     } else if (pos > pivot) {
    //         rAcc++;
    //     }
    //     lhsPrefixSum[i + 1] = lAcc;
    //     rhsPrefixSum[i + 1] = rAcc;
    // }

    // 3. LCP & IdRanges 동시 추출 (최적화 구간)
    const lcp = new Int32Array(n);
    // [ID * 2] = start, [ID * 2 + 1] = end (exclusive)
    const idRanges = new Int32Array((maxId + 1) * 2).fill(-1);

    let h = 0;
    for (let i = 0; i < n; i++) {
        const r = rank[i];

        // --- IdRanges 추출 로직 통합 ---
        const id = combinedIds[i]; // SA[r]은 i이므로, i 위치의 ID 확인
        if (id > 0) {
            const base = id * 2;
            // SA 상의 현재 순위(r)를 기록
            if (idRanges[base] === -1 || r < idRanges[base]) {
                idRanges[base] = r;
            }
            if (r >= idRanges[base + 1]) {
                idRanges[base + 1] = r + 1;
            }
        }
        // ----------------------------

        if (r > 0) {
            const j = sa[r - 1];
            if (h > 0) h--;
            while (i + h < n && j + h < n && combinedIds[i + h] === combinedIds[j + h]) {
                h++;
            }
            lcp[r] = h;
        }
    }

    return {
        sa, rank, lcp, idRanges
        // , lhsPrefixSum, rhsPrefixSum 
    };
}