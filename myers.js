function myersDiff(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, vectorUp = [], vectorDown = []) {
	// Recursively calculate the diff for the left and right parts
	const diffs = [];

	// Skip common prefix
	let matchedCount;
	while (lhsLower < lhsUpper && rhsLower < rhsUpper) {
		// 일단 빠른 비교!
		if (lhsTokens[lhsLower].text === rhsTokens[rhsLower].text) {
			diffs.push({
				type: 0,
				left: { pos: lhsLower, len: 1, text: lhsTokens[lhsLower].text },
				right: { pos: rhsLower, len: 1, text: rhsTokens[rhsLower].text },
			});
			lhsLower++;
			rhsLower++;
		} else if (
			// 깡으로 매칭해보기 ㅋ
			lhsTokens[lhsLower].text.length !== rhsTokens[lhsLower].text.length && // 여기까지 왔는데 길이가 같다면 다른 문자열...이겠지
			lhsTokens[lhsLower].text[0] === rhsTokens[rhsLower].text[0] && // 첫글자까지는 일단 체크해보고
			(matchedCount = matchTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper))
		) {
			diffs.push({
				type: 0,
				left: { pos: lhsLower, len: matchedCount[0], text: lhsTokens[lhsLower].text },
				right: { pos: rhsLower, len: matchedCount[1], text: rhsTokens[rhsLower].text },
			});
			// console.log("matchedCount", matchedCount);
			lhsLower += matchedCount[0];
			rhsLower += matchedCount[1];
		} else {
			break;
		}
	}

	// Skip common suffix
	const tailDiffs = [];
	while (lhsUpper > lhsLower && rhsUpper > rhsLower) {
		if (lhsTokens[lhsUpper - 1].text === rhsTokens[rhsUpper - 1].text) {
			tailDiffs.push({
				type: 0,
				left: { pos: lhsUpper - 1, len: 1, text: lhsTokens[lhsUpper - 1].text },
				right: { pos: rhsUpper - 1, len: 1, text: rhsTokens[rhsUpper - 1].text },
			});
			lhsUpper--;
			rhsUpper--;
		} else if (
			lhsTokens[lhsUpper - 1].text.length !== rhsTokens[rhsUpper - 1].text.length && // 여기까지 왔는데 길이가 같다면 다른 문자열...이겠지
			lhsTokens[lhsUpper - 1].text[lhsTokens[lhsUpper - 1].text.length - 1] === rhsTokens[rhsUpper - 1].text[rhsTokens[rhsUpper - 1].text.length - 1] && // 첫글자까지는 일단 체크해보고...
			(matchedCount = matchTokensBackward(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper))
		) {
			// console.log("matchedCountBACKWARD", matchedCount);
			tailDiffs.push({
				type: 0,
				left: { pos: lhsUpper - matchedCount[0], len: matchedCount[0], text: lhsTokens[lhsUpper - matchedCount[0]].text },
				right: { pos: rhsUpper - matchedCount[1], len: matchedCount[1], text: rhsTokens[rhsUpper - matchedCount[1]].text },
			});
			lhsUpper -= matchedCount[0];
			rhsUpper -= matchedCount[1];
		} else {
			break;
		}
	}
	// while (lhsUpper > lhsLower && rhsUpper > rhsLower && lhsTokens[lhsUpper - 1].text === rhsTokens[rhsUpper - 1].text) {
	// 	tailDiffs.push({
	// 		type: 0,
	// 		left: { pos: lhsUpper - 1, len: 1, text: lhsTokens[lhsUpper - 1].text },
	// 		right: { pos: rhsUpper - 1, len: 1, text: rhsTokens[rhsUpper - 1].text },
	// 	});
	// 	lhsUpper--;
	// 	rhsUpper--;
	// }

	// If we have no more characters to compare, return empty diff
	if (lhsUpper > lhsLower || rhsUpper > rhsLower) {
		// Find the shortest middle snake between lhs and rhs
		const middleSnake = getShortestMiddleSnake(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, vectorUp, vectorDown);

		if (middleSnake.x > lhsLower && middleSnake.y > rhsLower) {
			// Left part of the text (lhsLower to middleSnake.x)
			const leftDiff = myersDiff(lhsTokens, lhsLower, middleSnake.x, rhsTokens, rhsLower, middleSnake.y, vectorUp, vectorDown);

			// Right part of the text (middleSnake.x to lhsUpper)
			const rightDiff = myersDiff(lhsTokens, middleSnake.x, lhsUpper, rhsTokens, middleSnake.y, rhsUpper, vectorUp, vectorDown);

			// Combine the left and right diffs
			diffs.push(...leftDiff, ...rightDiff);
		} else {
			// If no middle snake found, this means we're at the base case and just need to add the diff
			let diff = { type: 0, left: { pos: lhsLower, len: lhsUpper - lhsLower, text: "" }, right: { pos: rhsLower, len: rhsUpper - rhsLower, text: "" } };

			// Only push the diff if there is a change
			if (diff.left.len > 0 || diff.right.len > 0) {
				// If there is a left change
				if (lhsUpper - lhsLower > 0) {
					diff.left.text = lhsTokens
						.slice(lhsLower, lhsUpper)
						.map((t) => t.text)
						.join(" ");
					diff.type |= 1;
				}

				// If there is a right change
				if (rhsUpper - rhsLower > 0) {
					diff.right.text = rhsTokens
						.slice(rhsLower, rhsUpper)
						.map((t) => t.text)
						.join(" ");
					diff.type |= 2;
				}

				diffs.push(diff);
			}
		}
	}

	// Add the tail diffs to the result
	for (let i = tailDiffs.length - 1; i >= 0; i--) {
		diffs.push(tailDiffs[i]);
	}

	return diffs;
}

function getShortestMiddleSnake(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, vectorUp, vectorDown) {
	const max = lhsTokens.length + rhsTokens.length + 1;

	// Input validation
	if (max === undefined) {
		throw new Error("Unexpected state");
	}

	// Initialize variables
	let kDown = lhsLower - rhsLower;
	let kUp = lhsUpper - rhsUpper;
	let delta = lhsUpper - lhsLower - (rhsUpper - rhsLower);
	let isOdd = (delta & 1) !== 0;
	let offsetDown = max - kDown;
	let offsetUp = max - kUp;
	let maxD = Math.floor((lhsUpper - lhsLower + rhsUpper - rhsLower) / 2) + 1;
	let result = { x: 0, y: 0 };

	// Initialize vectors
	vectorDown[offsetDown + kDown + 1] = lhsLower;
	vectorUp[offsetUp + kUp - 1] = lhsUpper;

	// Perform search for the shortest middle snake
	for (let d = 0; d <= maxD; d++) {
		// Forward search (downward direction)
		for (let k = kDown - d; k <= kDown + d; k += 2) {
			let x;
			if (k === kDown - d) {
				x = vectorDown[offsetDown + k + 1]; // down
			} else {
				x = vectorDown[offsetDown + k - 1] + 1; // right
				if (k < kDown + d && vectorDown[offsetDown + k + 1] >= x) {
					x = vectorDown[offsetDown + k + 1]; // down
				}
			}

			let y = x - k;
			// Find the end of the furthest reaching forward D-path in diagonal k.
			while (x < lhsUpper && y < rhsUpper && lhsTokens[x].text === rhsTokens[y].text) {
				x++;
				y++;
			}

			vectorDown[offsetDown + k] = x;

			// Check for overlap with reverse path (upward direction)
			if (isOdd && kUp - d < k && k < kUp + d && vectorUp[offsetUp + k] <= vectorDown[offsetDown + k]) {
				result.x = vectorDown[offsetDown + k];
				result.y = vectorDown[offsetDown + k] - k;
				return result;
			}
		}

		// Reverse search (upward direction)
		for (let k = kUp - d; k <= kUp + d; k += 2) {
			let x;
			if (k === kUp + d) {
				x = vectorUp[offsetUp + k - 1]; // up
			} else {
				x = vectorUp[offsetUp + k + 1] - 1; // left
				if (k > kUp - d && vectorUp[offsetUp + k - 1] < x) {
					x = vectorUp[offsetUp + k - 1]; // up
				}
			}

			let y = x - k;
			while (x > lhsLower && y > rhsLower && lhsTokens[x - 1].text === rhsTokens[y - 1].text) {
				x--;
				y--;
			}

			vectorUp[offsetUp + k] = x;

			// Check for overlap with forward path (downward direction)
			if (!isOdd && kDown - d <= k && k <= kDown + d && vectorUp[offsetUp + k] <= vectorDown[offsetDown + k]) {
				result.x = vectorDown[offsetDown + k];
				result.y = vectorDown[offsetDown + k] - k;
				return result;
			}
		}
	}

	// If we reach here, something went wrong
	throw new Error("Unexpected state");
}

function postProcess(entries, leftText, rightText, leftTokens, rightTokens) {
	let prevDiff = null;
	const newDiffs = [];
	const anchors = [];

	for (let i = 0; i < entries.length; i++) {
		const entry = entries[i];
		if (entry.left.len > 0 && entry.right.len > 0) {
			let leftToken = leftTokens[entry.left.pos];
			let rightToken = rightTokens[entry.right.pos];
			if (leftToken.flags & rightToken.flags & FIRST_OF_LINE) {
				console.log("START:", leftToken.text);
				anchors.push({
					left: leftToken.pos,
					right: rightToken.pos,
				});
			}

			leftToken = entry.left.len === 1 ? leftToken : leftTokens[entry.left.pos + entry.left.len - 1];
			rightToken = entry.right.len === 1 ? rightToken : rightTokens[entry.right.pos + entry.right.len - 1];
			if (leftToken.flags & rightToken.flags & LAST_OF_LINE) {
				console.log("END:", leftToken.text);
			}
		}
	}

	// for (let i = 0; i < diffs.length; i++) {
	// 	const diff = diffs[i];
	// 	if (prevDiff !== null && prevDiff.left.pos + prevDiff.left.len === diff.left.pos && prevDiff.right.pos + prevDiff.right.len === diff.right.pos) {
	// 		prevDiff.left.len += diff.left.len;
	// 		prevDiff.left.text += " " + diff.left.text;
	// 		prevDiff.right.len += diff.right.len;
	// 		prevDiff.right.text += " " + diff.right.text;
	// 	} else {
	// 		newDiffs.push(diff);
	// 		prevDiff = diff;
	// 	}
	// }
	// return newDiffs;
	return entries;
}

// Example usage:
const textA = `function tokenize(text) {
	// This is a basic tokenizer  splits text into words, can be customized for your needs
	return text.split(" ").map((word, idx) => ({  word, idx }));
}
`;
const textB = `func tion tokenize(text) {
	// dThis is a dbasic tokeni zer that sdplits text into words, can be customized for your ne eds
	rdeturn text.split(" ").map((word, idxd) => ({ text: word, idx } ) ) ; 
}

`;
const wordTokensA = tokenize(textA);
const wordTokensB = tokenize(textB);
console.log("Tokens A:", wordTokensA);
console.log("Tokens B:", wordTokensB);
const diff = myersDiff(wordTokensA, 0, wordTokensA.length, wordTokensB, 0, wordTokensB.length, [], []);
console.log(postProcess(diff, textA, textB, wordTokensA, wordTokensB));
