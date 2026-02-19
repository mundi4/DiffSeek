// import { describe, it, expect, beforeEach } from 'vitest';
// import { Tokenizer } from '../src/core/tokenization/tokenizer';
// import { TokenType } from '../src/core/types';
// import { TokenFlags } from '../src/core/TokenFlags';

// describe('Tokenizer', () => {
//     let tokenizer: Tokenizer;
//     let container: HTMLDivElement;

//     beforeEach(() => {
//         tokenizer = new Tokenizer();
//         container = document.createElement('div');
//     });

//     async function tokenize(text: string) {
//         container.innerHTML = text;
//         return await tokenizer.tokenizeAsync(container);
//     }

//     it("handles inline formatting tags within a single div", async () => {
//         const result = await tokenize(`
//         <div>Hello <strong>world</strong>!</div>
//         `);

//         const { tokens, lineStartPoints } = result;

//         expect(tokens).toHaveLength(3);
//         expect(lineStartPoints).toHaveLength(1);

//         // Verify all tokens are on the same line
//         expect(tokens.map(t => ({ text: t.text, line: t.lineNumber }))).toEqual([
//             { text: "Hello", line: 1 },
//             { text: "world", line: 1 },
//             { text: "!", line: 1 }
//         ]);

//         // Verify line start point
//         expect(lineStartPoints[0].where).toBe("beforebegin");
//         expect(lineStartPoints[0].which?.nodeName).toBe("DIV");
//     });

//     it("treats each div as a separate line", async () => {
//         const result = await tokenize(`
//         <div>First line</div>
//         <div>Second line</div>
//         <div>Third line</div>
//         `);

//         const { tokens, lineStartPoints } = result;

//         expect(tokens).toHaveLength(6);
//         expect(lineStartPoints).toHaveLength(3);

//         // Verify tokens are distributed across three lines
//         expect(tokens.map(t => ({ text: t.text, line: t.lineNumber }))).toEqual([
//             { text: "First", line: 1 },
//             { text: "line", line: 1 },
//             { text: "Second", line: 2 },
//             { text: "line", line: 2 },
//             { text: "Third", line: 3 },
//             { text: "line", line: 3 }
//         ]);

//         // Verify all line start points are DIV elements
//         lineStartPoints.forEach(point => {
//             expect(point.which?.nodeName).toBe("DIV");
//             expect(point.where).toBe("beforebegin");
//         });
//     });

//     it("treats br tags as line breaks within a block", async () => {
//         const result = await tokenize(`
//         <div>First line<br>Second line<br>Third line</div>
//         `);

//         const { tokens, lineStartPoints } = result;

//         expect(tokens).toHaveLength(6);
//         expect(lineStartPoints).toHaveLength(3);

//         // Verify tokens are distributed across three lines
//         expect(tokens.map(t => ({ text: t.text, line: t.lineNumber }))).toEqual([
//             { text: "First", line: 1 },
//             { text: "line", line: 1 },
//             { text: "Second", line: 2 },
//             { text: "line", line: 2 },
//             { text: "Third", line: 3 },
//             { text: "line", line: 3 }
//         ]);

//         // First line starts at the DIV
//         expect(lineStartPoints[0].which?.nodeName).toBe("DIV");
//         expect(lineStartPoints[0].where).toBe("beforebegin");

//         // Subsequent lines start after BR tags
//         expect(lineStartPoints[1].which?.nodeName).toBe("BR");
//         expect(lineStartPoints[1].where).toBe("afterend");
//         expect(lineStartPoints[2].which?.nodeName).toBe("BR");
//         expect(lineStartPoints[2].where).toBe("afterend");
//     });

//     it("treats each paragraph as a separate line", async () => {
//         const result = await tokenize(`
//         <p>First paragraph</p>
//         <p>Second paragraph</p>
//         <p>Third paragraph</p>
//         `);

//         const { tokens, lineStartPoints } = result;

//         expect(tokens).toHaveLength(6);
//         expect(lineStartPoints).toHaveLength(3);

//         // Verify tokens are distributed across three lines
//         expect(tokens.map(t => ({ text: t.text, line: t.lineNumber }))).toEqual([
//             { text: "First", line: 1 },
//             { text: "paragraph", line: 1 },
//             { text: "Second", line: 2 },
//             { text: "paragraph", line: 2 },
//             { text: "Third", line: 3 },
//             { text: "paragraph", line: 3 }
//         ]);

//         // Verify all line start points are P elements
//         lineStartPoints.forEach(point => {
//             expect(point.which?.nodeName).toBe("P");
//             expect(point.where).toBe("beforebegin");
//         });
//     });

//     it("tokenizes plain text without any HTML tags as a single line", async () => {
//         const result = await tokenize(`Hello world from plain text`);

//         const { tokens, lineStartPoints } = result;

//         expect(tokens).toHaveLength(5);
//         expect(lineStartPoints).toHaveLength(1);

//         // All tokens should be on line 1
//         expect(tokens.map(t => ({ text: t.text, line: t.lineNumber }))).toEqual([
//             { text: "Hello", line: 1 },
//             { text: "world", line: 1 },
//             { text: "from", line: 1 },
//             { text: "plain", line: 1 },
//             { text: "text", line: 1 }
//         ]);

//         // Verify line start point for container
//         expect(lineStartPoints[0].which?.nodeName).toBe("DIV");
//     });

//     it("handles inline elements with br creating line breaks", async () => {
//         const result = await tokenize(`Hello <span>world</span><br> <em>with</em> <strong>inline</strong> elements`);
//         const { tokens, lineStartPoints } = result;

//         expect(tokens).toHaveLength(5);
//         expect(lineStartPoints).toHaveLength(2);

//         // Verify tokens are split by br tag
//         expect(tokens.map(t => ({ text: t.text, line: t.lineNumber }))).toEqual([
//             { text: "Hello", line: 1 },
//             { text: "world", line: 1 },
//             { text: "with", line: 2 },
//             { text: "inline", line: 2 },
//             { text: "elements", line: 2 }
//         ]);

//         // First line starts at container(as first child)
//         expect(lineStartPoints[0].which?.nodeName).toBe(container.nodeName);
//         expect(lineStartPoints[0].where).toBe("afterbegin");

//         // Second line starts after BR
//         expect(lineStartPoints[1].which?.nodeName).toBe("BR");
//         expect(lineStartPoints[1].where).toBe("afterend");
//     });

//     it("handles complex mix of div and br elements", async () => {
//         const result = await tokenize(`
//         <div>First div<br>with br</div>
//         <div>Second div</div>
//         <div>Third<br>has<br>multiple brs</div>
//         `);

//         const { tokens, lineStartPoints } = result;

//         expect(tokens).toHaveLength(10);
//         expect(lineStartPoints).toHaveLength(6);

//         // Verify token distribution across lines
//         expect(tokens.map(t => ({ text: t.text, line: t.lineNumber }))).toEqual([
//             { text: "First", line: 1 },
//             { text: "div", line: 1 },
//             { text: "with", line: 2 },
//             { text: "br", line: 2 },
//             { text: "Second", line: 3 },
//             { text: "div", line: 3 },
//             { text: "Third", line: 4 },
//             { text: "has", line: 5 },
//             { text: "multiple", line: 6 },
//             { text: "brs", line: 6 }
//         ]);

//         // Line 1: First DIV
//         expect(lineStartPoints[0].which?.nodeName).toBe("DIV");
//         expect(lineStartPoints[0].where).toBe("beforebegin");

//         // Line 2: BR within first DIV
//         expect(lineStartPoints[1].which?.nodeName).toBe("BR");
//         expect(lineStartPoints[1].where).toBe("afterend");

//         // Line 3: Second DIV
//         expect(lineStartPoints[2].which?.nodeName).toBe("DIV");
//         expect(lineStartPoints[2].where).toBe("beforebegin");

//         // Line 4: Third DIV
//         expect(lineStartPoints[3].which?.nodeName).toBe("DIV");
//         expect(lineStartPoints[3].where).toBe("beforebegin");

//         // Lines 5-6: BRs within third DIV
//         expect(lineStartPoints[4].which?.nodeName).toBe("BR");
//         expect(lineStartPoints[5].which?.nodeName).toBe("BR");
//     });

//     it("handles br followed by whitespace before block end", async () => {
//         const result = await tokenize(`
//         <div>Line one<br>   </div>
//         <div>Line two</div>
//         `);

//         const { tokens, lineStartPoints } = result;

//         expect(tokens).toHaveLength(4);

//         expect(tokens.map(t => ({ text: t.text, line: t.lineNumber }))).toEqual([
//             { text: "Line", line: 1 },
//             { text: "one", line: 1 },
//             { text: "Line", line: 2 },
//             { text: "two", line: 2 }
//         ]);

//         // BR creates line break but whitespace after doesn't create empty line
//         expect(lineStartPoints.some(p => p.which?.nodeName === "BR")).toBe(true);
//     });

//     it("handles br followed by nbsp before block end", async () => {
//         const result = await tokenize(`
//         <div>Text here<br>&nbsp;</div>
//         <div>Next block</div>
//         `);

//         const { tokens, lineStartPoints } = result;

//         expect(tokens).toHaveLength(4);

//         expect(tokens.map(t => ({ text: t.text, line: t.lineNumber }))).toEqual([
//             { text: "Text", line: 1 },
//             { text: "here", line: 1 },
//             { text: "Next", line: 2 },
//             { text: "block", line: 2 }
//         ]);
//     });

//     it("handles br with no trailing content before block end", async () => {
//         const result = await tokenize(`
//         <div>Content<br></div>
//         <div>More content</div>
//         `);

//         const { tokens, lineStartPoints } = result;

//         expect(tokens).toHaveLength(3);

//         expect(tokens.map(t => ({ text: t.text, line: t.lineNumber }))).toEqual([
//             { text: "Content", line: 1 },
//             { text: "More", line: 2 },
//             { text: "content", line: 2 }
//         ]);
//     });

//     it("handles multiple br tags with mixed whitespace", async () => {
//         const result = await tokenize(`
//         <div>Start<br><br>  <br>End</div>
//         `);

//         const { tokens, lineStartPoints } = result;

//         expect(tokens).toHaveLength(2);

//         expect(tokens.map(t => ({ text: t.text, line: t.lineNumber }))).toEqual([
//             { text: "Start", line: 1 },
//             { text: "End", line: 4 }
//         ]);

//         // Multiple BRs should create empty lines
//         expect(lineStartPoints.length).toBeGreaterThanOrEqual(4);
//     });

//     it("handles nested divs with br tags", async () => {
//         const result = await tokenize(`
//         <div>Outer start<br><div>Inner block</div>Outer end</div>
//         `);

//         const { tokens, lineStartPoints } = result;

//         expect(tokens.map(t => t.text)).toEqual([
//             "Outer", "start", "Inner", "block", "Outer", "end"
//         ]);

//         // Verify proper line number assignment
//         expect(tokens[0].lineNumber).toBe(1);  // Outer
//         expect(tokens[1].lineNumber).toBe(1);  // start
//         expect(tokens[2].lineNumber).toBe(2);  // Inner (after BR or in new DIV)
//         expect(tokens[3].lineNumber).toBe(2);  // block
//     });
// });
