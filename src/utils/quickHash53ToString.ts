export function quickHash53(str: string): string {
	let hash = 0n;
	const PRIME = 131n;
	for (let i = 0; i < str.length; i++) {
		hash = hash * PRIME + BigInt(str.charCodeAt(i));
		hash &= 0x1fffffffffffffn; // 53비트 마스크
	}
	return hash.toString(36); // 36진수 문자열 변환
}
