(function (client, React) {
  'use strict';var __vite_style__ = document.createElement('style');__vite_style__.textContent = ":root {\n  --color-background-base__n3s9w90: #ffffff;\n  --color-background-muted__n3s9w91: #f8f9fa;\n  --color-foreground-base__n3s9w92: #1f2937;\n  --color-foreground-muted__n3s9w93: #6b7280;\n  --color-foreground-subtle__n3s9w94: #9ca3af;\n  --color-border-base__n3s9w95: #d1d5db;\n  --color-border-muted__n3s9w96: #e5e7eb;\n  --color-accent-blue__n3s9w97: #3b82f6;\n  --color-accent-red__n3s9w98: #ef4444;\n  --color-accent-green__n3s9w99: #10b981;\n  --color-accent-yellow__n3s9w9a: #facc15;\n  --font-body__n3s9w9b: system-ui, sans-serif;\n  --font-mono__n3s9w9c: \"Nanum Gothic Coding\", \"돋움체\", monospace;\n  --spacing-none__n3s9w9d: 0;\n  --spacing-xs__n3s9w9e: 4px;\n  --spacing-sm__n3s9w9f: 8px;\n  --spacing-md__n3s9w9g: 12px;\n  --spacing-lg__n3s9w9h: 16px;\n  --spacing-xl__n3s9w9i: 24px;\n  --radius-sm__n3s9w9j: 4px;\n  --radius-md__n3s9w9k: 8px;\n  --radius-lg__n3s9w9l: 12px;\n  --radius-pill__n3s9w9m: 9999px;\n  --shadow-sm__n3s9w9n: 0 1px 2px rgba(0, 0, 0, 0.05);\n  --shadow-md__n3s9w9o: 0 2px 4px rgba(0, 0, 0, 0.1);\n  --shadow-lg__n3s9w9p: 0 4px 8px rgba(0, 0, 0, 0.1);\n  --zIndex-base__n3s9w9q: 0;\n  --zIndex-dropdown__n3s9w9r: 1000;\n  --zIndex-modal__n3s9w9s: 1100;\n  --zIndex-overlay__n3s9w9t: 1200;\n  --zIndex-popover__n3s9w9u: 1300;\n  --zIndex-tooltip__n3s9w9v: 1400;\n}*, *::before, *::after {\n  box-sizing: border-box;\n}\nhtml, body {\n  margin: 0;\n  padding: 0;\n  font-family: var(--font-body__n3s9w9b);\n  background-color: var(--color-background-base__n3s9w90);\n  color: var(--color-foreground-base__n3s9w92);\n  line-height: 1.5;\n  -webkit-font-smoothing: antialiased;\n  -moz-osx-font-smoothing: grayscale;\n  height: 100%;\n}\ninput, button, textarea, select {\n  font: inherit;\n}\ncode, pre {\n  font-family: var(--font-mono__n3s9w9c);\n}\na {\n  color: var(--color-accent-blue__n3s9w97);\n  text-decoration: none;\n}*, *::before, *::after {\n  box-sizing: border-box;\n}\nbody {\n  margin: 0;\n  line-height: 1.5;\n  -webkit-font-smoothing: antialiased;\n}\nh1, h2, h3, h4, h5, h6, p {\n  margin: 0;\n}\nul, ol {\n  padding: 0;\n  margin: 0;\n  list-style: none;\n}.Editor_wrapper__11exldh0 {\n  overflow-y: scroll;\n  height: 100%;\n  min-height: 0;\n}\n.Editor_wrapper__11exldh0:has(:focus) {\n  outline: 1px solid var(--editor-focus-outline-color, #007bff);\n}\n.Editor_editor__11exldh1 {\n  position: relative;\n  border: 0;\n  min-width: 0;\n  width: 100%;\n  min-height: 100%;\n  overflow-y: visible;\n  font-size: 14px;\n  padding: 4px;\n  line-height: 1.5;\n  scroll-padding-top: 3em;\n  word-break: break-all;\n  overflow-wrap: anywhere;\n  outline: none;\n  background-color: transparent;\n  z-index: 30;\n}\n.Editor_editor__11exldh1 table {\n  border-collapse: collapse;\n  border-spacing: 0;\n  table-layout: auto;\n}\n.Editor_editor__11exldh1 td {\n  position: relative;\n  vertical-align: top;\n  border: 1px solid var(--td-border-color, #666);\n  padding: 0px 0px;\n  min-height: 1.5rem;\n}\n.Editor_heightBoost__11exldh2 {\n  display: none;\n}.Renderer_wrapper__1fhw0ut0 {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n  z-index: 0;\n  overflow: hidden;\n}\n.Renderer_diffLayer__1fhw0ut1 {\n  z-index: 20;\n}\n.Renderer_highlightLayer__1fhw0ut2 {\n  z-index: 10;\n}\n.Renderer_wrapper__1fhw0ut0 canvas {\n  position: absolute;\n  top: 0;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  will-change: transform;\n}.EditorShell_editorShell__12kfwnu0 {\n  height: 100%;\n  min-height: 0;\n  border-width: 1px;\n  z-index: 10;\n}.RendererShell_rendererShell__rh59wk0 {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n}.EditorPanel_container__183fy150 {\n  display: grid;\n  height: 100%;\n  min-height: 0;\n  position: relative;\n}\n.EditorPanel_container_layout_vertical__183fy151 {\n  grid-template-rows: repeat(2, 1fr);\n}\n.EditorPanel_container_layout_horizontal__183fy152 {\n  grid-template-columns: repeat(2, 1fr);\n}\n.EditorPanel_container_syncMode_on__183fy153 {\n  background-color: var(--bg-sync-mode);\n  color: var(--text-sync-mode);\n}\n.EditorPanel_container_syncMode_off__183fy154 {\n  background-color: transparent;\n  color: inherit;\n}.DiffList_listWrapper__11u1ks00 {\n  height: 100%;\n  min-height: 0;\n  overflow-y: scroll;\n}\n.DiffList_diffList__11u1ks01 {\n  list-style: none;\n  padding: 0.25rem;\n}\n.DiffList_diffListItem__11u1ks02 {\n  padding-top: 0.25rem;\n  padding-bottom: 0.25rem;\n}\n.DiffList_diffCard__11u1ks03 {\n  outline: 1px solid hsl(var(--diff-hue), 100%, 40%);\n  border-radius: 0.125rem;\n  display: flex;\n  flex-direction: column;\n  gap: 0.125rem;\n  padding: 0.25rem;\n  position: relative;\n  cursor: pointer;\n  background-color: hsl(var(--diff-hue), 100%, 80%);\n  color: hsl(var(--diff-hue), 100%, 20%);\n}\n.DiffList_rangeText__11u1ks04 {\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}.AppSidebar_sidebar__1nmrnq00 {\n  height: 100%;\n  min-height: 0;\n  background-color: #f3f4f6;\n  border-left: 1px solid #d1d5db;\n}.SectionTrail_container__c1fe8g0 {\n  display: flex;\n  align-items: flex-start;\n  gap: 0.375rem;\n  padding: 0.25rem;\n}\n.SectionTrail_copyButton__c1fe8g1 {\n  display: inline-flex;\n  justify-content: center;\n  align-items: center;\n  width: 20px;\n  height: 20px;\n  font-size: 0.75rem;\n  font-family: monospace;\n  font-weight: bold;\n  border-radius: 25%;\n  border: 1px solid var(--border);\n  background-color: var(--foreground);\n  color: var(--background);\n  padding: 0;\n  flex-shrink: 0;\n  vertical-align: top;\n  user-select: none;\n}\n.SectionTrail_trailBlock__c1fe8g2 {\n  margin: 0;\n  font-size: 0.875rem;\n}\n.SectionTrail_ordinal__c1fe8g3 {\n  display: inline;\n  font-weight: bold;\n  color: var(--accent-foreground);\n}\n.SectionTrail_title__c1fe8g4 {\n  display: inline;\n}\n.SectionTrail_separator__c1fe8g5 {\n  color: #9ca3af;\n  margin: 0 0.25rem;\n}.EditableLabel\\ _label__6pycza0 {\n  display: inline-block;\n  cursor: text;\n  padding: 0.125rem 0.25rem;\n}\n.EditableLabel\\ _input__6pycza1 {\n  padding: 0.125rem 0.25rem;\n  font-size: 0.875rem;\n  border: 1px solid #ccc;\n  border-radius: 0.25rem;\n}\n.EditableLabel\\ _placeholder__6pycza2 {\n  font-style: italic;\n  color: #9ca3af;\n}.Magnifier_wrapper__1sbw3n20 {\n  position: fixed;\n  width: 20rem;\n  max-height: 18rem;\n  background-color: white;\n  border: 1px solid var(--border);\n  box-shadow: 0 0 4px rgba(0,0,0,0.1);\n  border-radius: 0.5rem;\n  z-index: 9999;\n  overflow: hidden;\n  display: grid;\n  grid-template-rows: auto auto minmax(0, 1fr);\n}\n.Magnifier_fallbackPosition__1sbw3n21 {\n  left: 91.6667%;\n  top: 91.6667%;\n}\n.Magnifier_header__1sbw3n22 {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  padding: 0.25rem 0.5rem;\n  border-bottom: 1px solid var(--border);\n  background-color: #f3f4f6;\n  cursor: move;\n}\n.Magnifier_select__1sbw3n23 {\n  font-size: 0.75rem;\n  background-color: transparent;\n  color: #374151;\n  border: 1px solid var(--border);\n  border-radius: 0.25rem;\n  padding: 0.125rem 0.25rem;\n  outline: none;\n  cursor: pointer;\n}\n.Magnifier_trail__1sbw3n24 {\n  overflow-y: auto;\n  border-bottom: 1px solid var(--border);\n  background-color: var(--background);\n  padding: 0.25rem 0.5rem;\n}\n.Magnifier_tooLongText__1sbw3n25 {\n  padding: 1rem;\n  text-align: center;\n}\n.Magnifier_warningText__1sbw3n26 {\n  font-size: 1rem;\n  font-weight: 600;\n  color: var(--destructive);\n}\n.Magnifier_hintText__1sbw3n27 {\n  font-style: italic;\n  font-size: 0.75rem;\n  color: var(--muted-foreground);\n}\n.Magnifier_loading__1sbw3n28 {\n  padding: 1rem;\n  text-align: center;\n  font-style: italic;\n  font-size: 0.875rem;\n  color: var(--muted-foreground);\n}\n.Magnifier_body__1sbw3n29 {\n  overflow-y: auto;\n  padding: 0.5rem;\n  font-size: 0.875rem;\n  font-family: NanumGothicCoding, 돋움체, monospace;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n.Magnifier_equal__1sbw3n2a {\n  background-color: hsl(var(--diff-equal-bg));\n  color: hsl(var(--diff-equal-text));\n}\n.Magnifier_delete___1sbw3n2b {\n  background-color: hsl(var(--diff-delete-bg));\n  color: hsl(var(--diff-delete-text));\n}\n.Magnifier_insert__1sbw3n2c {\n  background-color: hsl(var(--diff-insert-bg));\n  color: hsl(var(--diff-insert-text));\n}\n.Magnifier_container__1sbw3n2d {\n  display: grid;\n  gap: 0.5rem;\n  position: relative;\n  font-size: 0.875rem;\n  font-family: monospace;\n}\n.Magnifier_row__1sbw3n2e {\n  grid-template-columns: 1fr auto 1fr;\n}\n.Magnifier_col__1sbw3n2f {\n  grid-template-rows: 1fr auto 1fr;\n}\n.Magnifier_textBlock__1sbw3n2g {\n  min-width: 0;\n  overflow: visible;\n  white-space: pre-wrap;\n  word-break: break-word;\n}\n.Magnifier_dividerRow__1sbw3n2h {\n  height: 1px;\n  border-top: 1px solid var(--border-muted);\n}\n.Magnifier_dividerCol__1sbw3n2i {\n  width: 1px;\n  border-left: 1px solid var(--border-muted);\n}\n.Magnifier_flexRow__1sbw3n2j {\n  display: flex;\n  align-items: center;\n  column-gap: 0.5rem;\n}\n.Magnifier_closeButton__1sbw3n2k {\n  font-size: 0.875rem;\n  color: #4B5563;\n  margin-left: 0.25rem;\n}\n.Magnifier_closeButton__1sbw3n2k:hover {\n  color: #000000;\n}\n.Magnifier_noItalic__1sbw3n2l {\n  font-style: normal;\n}\n.Magnifier_labelLeft__1sbw3n2m {\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}.App_appLayout__1bg21ve0 {\n  width: 100vw;\n  height: 100vh;\n  display: grid;\n  grid-template-columns: 1fr var(--sidebar-width, 200px);\n}\n:root {\n  --bg-sync-mode: #f5f0e6;\n  --text-sync-mode: #2f2a24;\n  --diff-equal-bg: 0 0% 94%;\n  --diff-equal-text: 0 0% 20%;\n  --diff-insert-bg: 120 80% 85%;\n  --diff-insert-text: 140 100% 20%;\n  --diff-delete-bg: 0 80% 85%;\n  --diff-delete-text: 0 100% 30%;\n}/*$vite$:1*/";document.head.appendChild(__vite_style__);

  var jsxRuntime = {exports: {}};

  var reactJsxRuntime_production = {};

  /**
   * @license React
   * react-jsx-runtime.production.js
   *
   * Copyright (c) Meta Platforms, Inc. and affiliates.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   */

  var hasRequiredReactJsxRuntime_production;

  function requireReactJsxRuntime_production () {
  	if (hasRequiredReactJsxRuntime_production) return reactJsxRuntime_production;
  	hasRequiredReactJsxRuntime_production = 1;
  	var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"),
  	  REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
  	function jsxProd(type, config, maybeKey) {
  	  var key = null;
  	  void 0 !== maybeKey && (key = "" + maybeKey);
  	  void 0 !== config.key && (key = "" + config.key);
  	  if ("key" in config) {
  	    maybeKey = {};
  	    for (var propName in config)
  	      "key" !== propName && (maybeKey[propName] = config[propName]);
  	  } else maybeKey = config;
  	  config = maybeKey.ref;
  	  return {
  	    $$typeof: REACT_ELEMENT_TYPE,
  	    type: type,
  	    key: key,
  	    ref: void 0 !== config ? config : null,
  	    props: maybeKey
  	  };
  	}
  	reactJsxRuntime_production.Fragment = REACT_FRAGMENT_TYPE;
  	reactJsxRuntime_production.jsx = jsxProd;
  	reactJsxRuntime_production.jsxs = jsxProd;
  	return reactJsxRuntime_production;
  }

  var hasRequiredJsxRuntime;

  function requireJsxRuntime () {
  	if (hasRequiredJsxRuntime) return jsxRuntime.exports;
  	hasRequiredJsxRuntime = 1;
  	{
  	  jsxRuntime.exports = requireReactJsxRuntime_production();
  	}
  	return jsxRuntime.exports;
  }

  var jsxRuntimeExports = requireJsxRuntime();

  const COMPUTE_DIFF_TIMEOUT = 500;
  const DIFF_COLOR_HUES = [
    30,
    // 주황?
    180,
    // cyan
    300,
    // 핑크?
    120,
    // 초록
    240,
    // 파랑
    60,
    // 노랑
    270
    // 보라?
  ];
  const NUM_DIFF_COLORS = DIFF_COLOR_HUES.length;
  const BASE_FONT_SIZE = 16;
  const MANUAL_ANCHOR_ELEMENT_NAME = "HR";
  const DIFF_ELEMENT_NAME = "MARK";
  const LINE_HEIGHT = 1.5;
  const EDITOR_SCROLL_MARGIN = LINE_HEIGHT * 2 * BASE_FONT_SIZE;
  const HANGUL_ORDER = "가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허";
  const VOID_ELEMENTS = {
    AREA: true,
    BASE: true,
    BR: true,
    COL: true,
    COMMAND: true,
    EMBED: true,
    HR: true,
    IMG: true,
    INPUT: true,
    LINK: true,
    META: true,
    PARAM: true,
    SOURCE: true,
    TRACK: true,
    WBR: true
  };
  const TEXTLESS_ELEMENTS = {
    ...VOID_ELEMENTS,
    VIDEO: true,
    AUDIO: true,
    OBJECT: true,
    CANVAS: true,
    SVG: true,
    TABLE: true,
    THEAD: true,
    TBODY: true,
    TFOOT: true,
    TR: true,
    OL: true,
    UL: true,
    DL: true,
    STYLE: true,
    HEAD: true,
    TITLE: true,
    SCRIPT: true
  };
  const TEXT_FLOW_CONTAINERS = {
    TD: true,
    TH: true
    // DIV: true,
    // PRE: true,
    // BLOCKQUOTE: true,
    // LI: true,
    // SECTION: true,
    // ARTICLE: true,
    // HEADER: true,
    // FOOTER: true,
    // ASIDE: true,
    // MAIN: true,
    // CAPTION: true,
    // FIGURE: true,
    // FIGCAPTION: true,
  };
  const BLOCK_ELEMENTS = {
    DD: true,
    DT: true,
    DIV: true,
    P: true,
    H1: true,
    H2: true,
    H3: true,
    H4: true,
    H5: true,
    H6: true,
    UL: true,
    OL: true,
    LI: true,
    BLOCKQUOTE: true,
    FORM: true,
    HEADER: true,
    FOOTER: true,
    ARTICLE: true,
    SECTION: true,
    ASIDE: true,
    NAV: true,
    ADDRESS: true,
    FIGURE: true,
    FIGCAPTION: true,
    TABLE: true,
    CAPTION: true,
    TR: true,
    //TD: true,
    "#document-fragment": true
  };
  const FRAME_BUDGET_MS = 1e3 / 60;

  function createTrie(ignoreSpaces = false) {
    const root = createTrieNode(ignoreSpaces);
    function insert(word, flags = 0) {
      let node = root;
      for (let i = 0; i < word.length; i++) {
        node = node.addChild(word[i]);
      }
      node.word = word;
      node.flags = flags;
    }
    return { insert, root };
  }
  function createTrieNode(ignoreSpaces) {
    const children = {};
    const node = {
      children,
      word: null,
      flags: 0,
      next(char) {
        if (ignoreSpaces && char === " ") return node;
        return children[char] || null;
      },
      addChild(char) {
        return children[char] ?? (children[char] = createTrieNode(ignoreSpaces));
      }
    };
    return node;
  }
  function extractStartCharsFromTrie(trie) {
    const table = {};
    for (const ch in trie.children) {
      table[ch] = 1;
    }
    return table;
  }

  const normalizedCharMap = ((normChars) => {
    const result = {};
    function getCharCode(char) {
      if (typeof char === "number") {
        return char;
      }
      return char.codePointAt(0);
    }
    for (const entry of normChars) {
      const [norm, ...variants] = entry;
      const normCharCode = getCharCode(norm);
      for (const variant of variants) {
        const variantCharCode = getCharCode(variant);
        result[variantCharCode] = normCharCode;
      }
    }
    return result;
  })([
    ['"', "“", "”", "'", "‘", "’"],
    // 비즈플랫폼 편집기에서 작은따옴표를 큰따옴표로 바꾸어버림. WHY?
    ["-", "‐", "‑", "‒", "–", "﹘", "—", "－"],
    [".", "․", "．"],
    [",", "，"],
    ["•", "●"],
    // 이걸 중간점 용도로 쓰는 사람들은 정말 갈아마셔야된다. 도저히 용납해줄 수 없고 같은 문자로 인식하게 만들고 싶지 않다.
    ["◦", "○", "ㅇ"],
    // 자음 "이응"을 쓰는 사람들도 개인적으로 이해가 안되지만 많더라.
    ["■", "▪", "◼"],
    ["□", "▫", "◻", "ㅁ"],
    ["·", "⋅", "∙", "ㆍ", "‧"],
    // 유니코드를 만든 집단은 도대체 무슨 생각이었던걸까?...
    ["…", "⋯"],
    ["(", "（"],
    [")", "）"],
    ["[", "［"],
    ["]", "］"],
    ["{", "｛"],
    ["}", "｝"],
    ["<", "＜"],
    [">", "＞"],
    ["=", "＝"],
    ["+", "＋"],
    ["*", "＊", "✱", "×", "∗"],
    ["/", "／", "÷"],
    ["\\", "₩"],
    // 아마도 원화 기호로 사용했겠지
    ["&", "＆"],
    ["#", "＃"],
    ["@", "＠"],
    ["$", "＄"],
    ["%", "％"],
    ["^", "＾"],
    ["~", "～"],
    ["`", "｀"],
    ["|", "｜"],
    [":", "："],
    [";", "；"],
    ["?", "？"],
    ["!", "！"],
    ["_", "＿"],
    ["→", "⇒", "➡", "➔", "➞", "➟"],
    ["←", "⇐", "⬅", "⟵", "⟸"],
    ["↑", "⇑", "⬆"],
    ["↓", "⇓", "⬇"],
    ["↔", "⇔"],
    ["↕", "⇕"],
    [" ", " "],
    ["0", "😒"]
  ]);

  function quickHash53ToString(str) {
    let hash = 0n;
    const PRIME = 131n;
    for (let i = 0; i < str.length; i++) {
      hash = hash * PRIME + BigInt(str.charCodeAt(i));
      hash &= 0x1fffffffffffffn;
    }
    return hash.toString(36);
  }

  const MANUAL_ANCHOR1 = "🔗@";
  const MANUAL_ANCHOR2 = "🔗#";
  var TokenFlags = /* @__PURE__ */ ((TokenFlags2) => {
    TokenFlags2[TokenFlags2["None"] = 0] = "None";
    TokenFlags2[TokenFlags2["LINE_START"] = 1] = "LINE_START";
    TokenFlags2[TokenFlags2["LINE_END"] = 2] = "LINE_END";
    TokenFlags2[TokenFlags2["BLOCK_START"] = 4] = "BLOCK_START";
    TokenFlags2[TokenFlags2["BLOCK_END"] = 8] = "BLOCK_END";
    TokenFlags2[TokenFlags2["CONTAINER_START"] = 16] = "CONTAINER_START";
    TokenFlags2[TokenFlags2["CONTAINER_END"] = 32] = "CONTAINER_END";
    TokenFlags2[TokenFlags2["TABLE_START"] = 64] = "TABLE_START";
    TokenFlags2[TokenFlags2["TABLE_END"] = 128] = "TABLE_END";
    TokenFlags2[TokenFlags2["TABLEROW_START"] = 256] = "TABLEROW_START";
    TokenFlags2[TokenFlags2["TABLEROW_END"] = 512] = "TABLEROW_END";
    TokenFlags2[TokenFlags2["TABLECELL_START"] = 1024] = "TABLECELL_START";
    TokenFlags2[TokenFlags2["TABLECELL_END"] = 2048] = "TABLECELL_END";
    TokenFlags2[TokenFlags2["NO_JOIN_PREV"] = 4096] = "NO_JOIN_PREV";
    TokenFlags2[TokenFlags2["NO_JOIN_NEXT"] = 8192] = "NO_JOIN_NEXT";
    TokenFlags2[TokenFlags2["WILD_CARD"] = 16384] = "WILD_CARD";
    TokenFlags2[TokenFlags2["MANUAL_ANCHOR"] = 32768] = "MANUAL_ANCHOR";
    TokenFlags2[TokenFlags2["IMAGE"] = 65536] = "IMAGE";
    TokenFlags2[TokenFlags2["HTML_SUP"] = 131072] = "HTML_SUP";
    TokenFlags2[TokenFlags2["HTML_SUB"] = 262144] = "HTML_SUB";
    TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE1"] = 524288] = "SECTION_HEADING_TYPE1";
    TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE2"] = 1048576] = "SECTION_HEADING_TYPE2";
    TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE3"] = 2097152] = "SECTION_HEADING_TYPE3";
    TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE4"] = 4194304] = "SECTION_HEADING_TYPE4";
    TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE5"] = 8388608] = "SECTION_HEADING_TYPE5";
    TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE6"] = 16777216] = "SECTION_HEADING_TYPE6";
    TokenFlags2[TokenFlags2["SECTION_HEADING_MASK"] = 33030144] = "SECTION_HEADING_MASK";
    return TokenFlags2;
  })(TokenFlags || {});
  const spaceChars = {
    " ": true,
    "	": true,
    "\n": true,
    " ": true,
    // &nbsp; ??
    "\r": true,
    // 글쎄...
    "\f": true,
    // 이것들은...
    "\v": true
    // 볼일이 없을것...
  };
  const wildcardTrie = createTrie(true);
  wildcardTrie.insert("(추가)", 16384 /* WILD_CARD */);
  wildcardTrie.insert("(삭제)", 16384 /* WILD_CARD */);
  wildcardTrie.insert("(신설)", 16384 /* WILD_CARD */);
  wildcardTrie.insert("(생략)", 16384 /* WILD_CARD */);
  wildcardTrie.insert("(현행과같음)", 16384 /* WILD_CARD */);
  const wildcardTrieNode = wildcardTrie.root.next("(");
  const sectionHeadingTrie = createTrie(false);
  for (let i = 1; i < 40; i++) {
    sectionHeadingTrie.insert(`${i}.`, 524288 /* SECTION_HEADING_TYPE1 */);
    sectionHeadingTrie.insert(`(${i})`, 2097152 /* SECTION_HEADING_TYPE3 */);
    sectionHeadingTrie.insert(`${i})`, 8388608 /* SECTION_HEADING_TYPE5 */);
  }
  for (let i = 0; i < HANGUL_ORDER.length; i++) {
    sectionHeadingTrie.insert(`${HANGUL_ORDER[i]}.`, 1048576 /* SECTION_HEADING_TYPE2 */);
    sectionHeadingTrie.insert(`(${HANGUL_ORDER[i]})`, 4194304 /* SECTION_HEADING_TYPE4 */);
    sectionHeadingTrie.insert(`${HANGUL_ORDER[i]})`, 16777216 /* SECTION_HEADING_TYPE6 */);
  }
  const SectionHeadingTrieNode = sectionHeadingTrie.root;
  const sectionHeadingStartChars = extractStartCharsFromTrie(SectionHeadingTrieNode);
  function normalize(text) {
    let result = "";
    for (const char of text) {
      const charCode = char.codePointAt(0);
      const normCharCode = normalizedCharMap[charCode];
      if (normCharCode !== void 0) {
        result += String.fromCodePoint(normCharCode);
      } else {
        result += char;
      }
    }
    return result;
  }
  class TokenizeContext {
    #rootContent;
    #onDone;
    #cancelled;
    #generator = null;
    #callbackId = null;
    constructor(rootContent, onDone) {
      this.#rootContent = rootContent;
      this.#onDone = onDone;
      this.#cancelled = false;
    }
    start() {
      if (this.#cancelled) {
        throw new Error("Cannot start a cancelled context");
      }
      if (this.#callbackId !== null) {
        throw new Error("Cannot reuse context");
      }
      this.#queueNextStep();
    }
    cancel() {
      this.#cancelled = true;
      if (this.#callbackId !== null) {
        cancelIdleCallback(this.#callbackId);
        this.#callbackId = null;
      }
    }
    #step(idleDeadline) {
      if (this.#cancelled) {
        return;
      }
      if (this.#generator === null) {
        this.#generator = this.#generate(idleDeadline);
      }
      const { done, value } = this.#generator.next(idleDeadline);
      if (this.#cancelled) {
        return;
      }
      if (done) {
        this.#onDone(value.tokens);
      } else {
        this.#queueNextStep();
      }
    }
    #queueNextStep() {
      this.#callbackId = requestIdleCallback((IdleDeadline) => this.#step(IdleDeadline), { timeout: 500 });
    }
    *#generate(idleDeadline) {
      const tokens = [];
      const containers = /* @__PURE__ */ new Map();
      const root = this.#rootContent;
      const textNodeBuf = [];
      let tokenIndex = 0;
      let currentToken = null;
      let nextTokenFlags = 0;
      let recursionCount = 0;
      let lineNum = 1;
      let shouldNormalize = false;
      const blockStack = [];
      let currentBlock = null;
      const containerStack = [];
      let currentContainer = {
        element: root,
        parent: null,
        depth: 0,
        startTokenIndex: 0,
        tokenCount: 0
      };
      function processToken(textNode, startOffset, endOffset, flags = 0) {
        let text = textNode.nodeValue.slice(startOffset, endOffset);
        if (shouldNormalize) {
          text = normalize(text);
          shouldNormalize = false;
        }
        if (currentToken) {
          currentToken.text += text;
          currentToken.range.endContainer = textNode;
          currentToken.range.endOffset = endOffset;
        } else {
          currentToken = {
            text,
            flags: nextTokenFlags | flags,
            range: {
              startContainer: textNode,
              startOffset,
              endContainer: textNode,
              endOffset
            },
            container: currentContainer,
            lineNum
          };
          nextTokenFlags = 0;
        }
      }
      function finalizeToken(flags = 0) {
        if (currentToken) {
          currentToken.flags |= flags;
          tokens[tokenIndex] = currentToken;
          if (tokenIndex > 0 && currentToken.flags & 2 /* LINE_END */) {
            tokens[tokenIndex - 1].flags |= 2 /* LINE_END */;
          }
          tokenIndex++;
          currentToken = null;
        }
      }
      function findInTrie(trie, bufferIndex, charIndex) {
        let node = trie;
        let i = bufferIndex;
        let j = charIndex;
        do {
          const text = textNodeBuf[i].nodeValue;
          for (; j < text.length; j++) {
            let ch = text[j];
            node = node.next(ch);
            if (!node) {
              return null;
            }
            if (node.word) {
              return { bufferIndex: i, charIndex: j + 1, word: node.word, flags: node.flags };
            }
          }
          i++;
          j = 0;
        } while (i < textNodeBuf.length);
        return null;
      }
      function doTokenizeText() {
        console.assert(textNodeBuf.length > 0, "textNodes should not be empty at this point");
        let nodeIndex = 0;
        let charIndex = 0;
        OUTER: do {
          const textNode = textNodeBuf[nodeIndex];
          const text = textNode.nodeValue;
          const textLen = text.length;
          let currentStart = -1;
          while (charIndex < textLen) {
            const cp = text.codePointAt(charIndex);
            if (normalizedCharMap[cp] !== void 0) {
              shouldNormalize = true;
            }
            let char = text[charIndex];
            if (spaceChars[char]) {
              if (currentStart !== -1) {
                processToken(textNode, currentStart, charIndex);
                currentStart = -1;
              }
              finalizeToken();
            } else {
              if (char === "(") {
                const match = findInTrie(wildcardTrieNode, nodeIndex, charIndex + 1);
                if (match) {
                  const startContainer = textNode;
                  const startOffset = charIndex;
                  if (currentStart !== -1) {
                    processToken(textNode, currentStart, charIndex);
                    currentStart = -1;
                  }
                  finalizeToken();
                  currentToken = {
                    text: match.word,
                    flags: nextTokenFlags | match.flags,
                    range: {
                      startContainer,
                      startOffset,
                      endContainer: textNodeBuf[match.bufferIndex],
                      endOffset: match.charIndex
                    },
                    container: currentContainer,
                    lineNum
                  };
                  nextTokenFlags = 0;
                  finalizeToken();
                  nodeIndex = match.bufferIndex;
                  charIndex = match.charIndex;
                  continue OUTER;
                }
              }
              if (sectionHeadingStartChars[char] && nextTokenFlags & 1 /* LINE_START */ && !currentToken && currentStart === -1) {
                const match = findInTrie(SectionHeadingTrieNode, nodeIndex, charIndex);
                if (match) {
                  const startContainer = textNode;
                  const startOffset = charIndex;
                  if (currentStart !== -1) {
                    processToken(textNode, currentStart, charIndex);
                    currentStart = -1;
                  }
                  finalizeToken();
                  currentToken = {
                    text: match.word,
                    flags: nextTokenFlags | match.flags,
                    range: {
                      startContainer,
                      startOffset,
                      endContainer: textNodeBuf[match.bufferIndex],
                      endOffset: match.charIndex
                    },
                    container: currentContainer,
                    lineNum
                  };
                  nextTokenFlags = 0;
                  finalizeToken();
                  nodeIndex = match.bufferIndex;
                  charIndex = match.charIndex;
                  continue OUTER;
                }
              }
              if (currentStart === -1) {
                currentStart = charIndex;
              }
            }
            charIndex++;
            if (cp > 65535) {
              charIndex++;
            }
          }
          if (currentStart !== -1) {
            processToken(textNode, currentStart, textLen);
            currentStart = -1;
          }
          nodeIndex++;
          charIndex = 0;
        } while (nodeIndex < textNodeBuf.length);
        finalizeToken();
        textNodeBuf.length = 0;
      }
      function* traverse(node) {
        const nodeName = node.nodeName;
        const isTextFlowContainer = TEXT_FLOW_CONTAINERS[nodeName] || node === root;
        const isBlockElement = BLOCK_ELEMENTS[nodeName];
        if (isTextFlowContainer) {
          containerStack.push(currentContainer);
          currentContainer = {
            element: node,
            parent: currentContainer,
            depth: currentContainer.depth + 1,
            startTokenIndex: tokenIndex,
            tokenCount: 0
          };
          nextTokenFlags |= 16 /* CONTAINER_START */ | 4 /* BLOCK_START */ | 1 /* LINE_START */;
        }
        if (isBlockElement) {
          if (currentBlock) {
            blockStack.push(currentBlock);
          }
          currentBlock = {
            element: node,
            container: currentContainer,
            depth: (currentBlock?.depth ?? -1) + 1,
            startTokenIndex: tokenIndex,
            tokenCount: 0
          };
          nextTokenFlags |= 4 /* BLOCK_START */ | 1 /* LINE_START */;
        }
        const isTokenBoundary = isTextFlowContainer || isBlockElement || nodeName === "TD";
        if (isTokenBoundary && textNodeBuf.length > 0) {
          doTokenizeText();
        }
        const childNodes = node.childNodes;
        const tokenStartIndex = tokenIndex;
        for (let i = 0; i < childNodes.length; i++) {
          if ((++recursionCount & 31) === 0 && idleDeadline.timeRemaining() < 2) {
            idleDeadline = yield;
          }
          const child = childNodes[i];
          if (child.nodeType === 3) {
            textNodeBuf.push(child);
          } else if (child.nodeType === 1) {
            const childNodeName = child.nodeName;
            if (childNodeName === DIFF_ELEMENT_NAME) {
              continue;
            }
            if (childNodeName === "IMG") {
              if (textNodeBuf.length > 0) {
                doTokenizeText();
              }
              const range = document.createRange();
              range.selectNode(child);
              currentToken = {
                text: quickHash53ToString(child.src),
                flags: 65536 /* IMAGE */ | 4096 /* NO_JOIN_PREV */ | 8192 /* NO_JOIN_NEXT */ | nextTokenFlags,
                range,
                container: currentContainer,
                lineNum
              };
              nextTokenFlags = 0;
              finalizeToken();
              continue;
            }
            if (childNodeName === MANUAL_ANCHOR_ELEMENT_NAME && child.classList.contains("manual-anchor")) {
              if (textNodeBuf.length > 0) {
                doTokenizeText();
              }
              nextTokenFlags |= 1 /* LINE_START */;
              lineNum++;
              if (textNodeBuf.length > 0) {
                doTokenizeText();
              }
              const range = document.createRange();
              range.selectNode(child);
              currentToken = {
                text: child.dataset.manualAnchor === "B" ? MANUAL_ANCHOR2 : MANUAL_ANCHOR1,
                flags: 32768 /* MANUAL_ANCHOR */ | 4096 /* NO_JOIN_PREV */ | 8192 /* NO_JOIN_NEXT */ | nextTokenFlags | 1 /* LINE_START */ | 2 /* LINE_END */,
                range,
                container: currentContainer,
                lineNum
              };
              nextTokenFlags = 0;
              finalizeToken();
              continue;
            }
            if (childNodeName === "BR" || childNodeName === "HR") {
              if (textNodeBuf.length > 0) {
                doTokenizeText();
              }
              nextTokenFlags |= 1 /* LINE_START */;
              lineNum++;
              continue;
            }
            yield* traverse(child);
          }
        }
        if (isTokenBoundary && textNodeBuf.length > 0) {
          doTokenizeText();
        }
        const tokenEndIndex = tokenIndex;
        const tokenCount = tokenEndIndex - tokenStartIndex;
        if (tokenCount > 0) {
          const firstToken = tokens[tokenStartIndex];
          const lastToken = tokens[tokenIndex - 1];
          if (nodeName === "SUP" || nodeName === "SUB") {
            const commonFlags = nodeName === "SUP" ? 131072 /* HTML_SUP */ : 262144 /* HTML_SUB */;
            for (let i = tokenStartIndex; i < tokenIndex; i++) {
              tokens[i].flags |= commonFlags;
            }
          } else if (nodeName === "TD" || nodeName === "TH") {
            if (firstToken) {
              firstToken.flags |= 1024 /* TABLECELL_START */ | 4096 /* NO_JOIN_PREV */ | 16 /* CONTAINER_START */ | 4 /* BLOCK_START */ | 1 /* LINE_START */;
            }
            if (lastToken) {
              lastToken.flags |= 2048 /* TABLECELL_END */ | 8192 /* NO_JOIN_NEXT */ | 32 /* CONTAINER_END */ | 8 /* BLOCK_END */ | 2 /* LINE_END */;
            }
            if (tokenCount > 0) {
              lineNum++;
            }
          } else if (nodeName === "TR") {
            if (firstToken) {
              firstToken.flags |= 256 /* TABLEROW_START */;
            }
            if (lastToken) {
              lastToken.flags |= 512 /* TABLEROW_END */;
            }
          } else if (nodeName === "TABLE") {
            if (firstToken) {
              firstToken.flags |= 64 /* TABLE_START */;
            }
            if (lastToken) {
              lastToken.flags |= 128 /* TABLE_END */;
            }
          }
          if (BLOCK_ELEMENTS[nodeName]) {
            if (firstToken) {
              firstToken.flags |= nextTokenFlags | 4 /* BLOCK_START */ | 1 /* LINE_START */;
            }
            if (lastToken) {
              lastToken.flags |= 8 /* BLOCK_END */ | 2 /* LINE_END */;
            }
            nextTokenFlags |= 1 /* LINE_START */;
            if (tokenCount > 0) {
              lineNum++;
            }
          }
          if (node === root) {
            firstToken.flags |= nextTokenFlags | 4 /* BLOCK_START */ | 16 /* CONTAINER_START */ | 1 /* LINE_START */;
            lastToken.flags |= 8 /* BLOCK_END */ | 32 /* CONTAINER_END */ | 2 /* LINE_END */;
          }
        }
        if (isBlockElement) {
          if (tokenCount > 0) {
            currentBlock.tokenCount = tokenEndIndex - currentBlock.startTokenIndex;
            tokens[tokens.length - 1].flags |= 8 /* BLOCK_END */ | 2 /* LINE_END */;
          }
          currentBlock = blockStack.pop() || null;
        }
        if (isTextFlowContainer) {
          if (tokenCount > 0) {
            currentContainer.tokenCount = tokenEndIndex - currentContainer.startTokenIndex;
            tokens[tokens.length - 1].flags |= 32 /* CONTAINER_END */ | 8 /* BLOCK_END */ | 2 /* LINE_END */;
            containers.set(node, currentContainer);
          }
          currentContainer = containerStack.pop();
        }
      }
      yield* traverse(root);
      tokens.length = tokenIndex;
      for (let i = 1; i < tokens.length; i++) {
        if (tokens[i].flags & 1 /* LINE_START */) {
          tokens[i - 1].flags |= 2 /* LINE_END */;
        }
      }
      return { tokens, containers };
    }
  }

  class DiffContext {
    //reqId: number;
    leftTokens;
    rightTokens;
    diffOptions;
    rawDiffs;
    entries;
    leftEntries;
    rightEntries;
    diffs;
    leftSectionHeadings;
    rightSectionHeadings;
    constructor(leftTokens, rightTokens, diffOptions, rawDiffs, entries, leftEntries, rightEntries, diffs, leftSectionHeadings = [], rightSectionHeadings = []) {
      this.leftTokens = leftTokens;
      this.rightTokens = rightTokens;
      this.diffOptions = diffOptions;
      this.rawDiffs = rawDiffs;
      this.entries = entries;
      this.leftEntries = leftEntries;
      this.rightEntries = rightEntries;
      this.diffs = diffs;
      this.leftSectionHeadings = leftSectionHeadings;
      this.rightSectionHeadings = rightSectionHeadings;
    }
    // 한쪽의 토큰span을 받고 반대쪽의 대응되는 span을 반환... 하는 것이 기본 포인트지만
    // 양쪽의 토큰들은 1:1 대응이 아니므로(예: ["가","나"] <-> ["가나"]) 대응되는 dest span에 역대응되는 span은 source span의 범위보다 클 수 있다.
    // 즉 source가 "가"를 가르킬때 dest에서는 "가나"가 그에 대응되고 dest의 "가나"에 대응되는건 source의 ["가","나"]임.
    // 그런 경우 source span도 적절히 확장해서 { left, right }의 형태로 반환함.
    // source->dest->source->dest->source->... 이런식으로 확장이 안될때까지 반복하는 방법을 쓰다가 잠들기 전에 새로운 방법이 생각나서 바꿈.
    resolveMatchingSpanPair(side, sourceSpan) {
      const thisEntries = this[`${side}Entries`];
      if (sourceSpan.start < 0 || sourceSpan.end < sourceSpan.start || sourceSpan.end > thisEntries.length) {
        return null;
      }
      const expand = (fromSide, span) => {
        const entries = this[`${fromSide}Entries`];
        let realStart = span.start;
        while (realStart > 0 && entries[realStart - 1][fromSide].start <= span.start && entries[realStart - 1][fromSide].end > span.start) {
          realStart--;
        }
        let realEnd = span.end;
        while (realEnd < entries.length && entries[realEnd][fromSide].start < span.end) {
          realEnd++;
        }
        return { start: realStart, end: realEnd };
      };
      const expanded = expand(side, sourceSpan);
      const otherSide = side === "left" ? "right" : "left";
      const thisFirstEntry = thisEntries[expanded.start];
      const thisLastEntry = thisEntries[Math.max(expanded.end - 1, expanded.start)];
      const result = side === "left" ? { left: expanded, right: { start: thisFirstEntry[otherSide].start, end: thisLastEntry[otherSide].end } } : { left: { start: thisFirstEntry[otherSide].start, end: thisLastEntry[otherSide].end }, right: expanded };
      return result;
    }
    // resolveMatchingSpanPair2(side: EditorName, sourceSpan: Span): { left: Span; right: Span } | null {
    // 	const otherSide = side === "left" ? "right" : "left";
    // 	const getOtherSpan = (fromSide: EditorName, span: Span): Span | null => {
    // 		const entries = this[`${fromSide}Entries`] as RawDiff[];
    // 		if (span.start < 0 || span.end <= span.start || span.end > entries.length) return null;
    // 		const other = fromSide === "left" ? "right" : "left";
    // 		const start = entries[span.start][other].start;
    // 		const end = entries[span.end - 1][other].end;
    // 		if (start < 0 || end < start) return null;
    // 		return { start, end };
    // 	};
    // 	let current = sourceSpan;
    // 	let other = getOtherSpan(side, current);
    // 	if (!other) {
    // 		return null;
    // 	}
    // 	// L: "가나 다라마", R: "가나다 라마"의 토큰들이 있을 때
    // 	// L의 "가나"에서 시작한다면 R의 "가나다"와 매칭이 된다. 하지만 R의 "가나다"와 매칭이 되는 토큰은 L의 "가나다라마"가 된다.
    // 	// 그리고 L의 "가나다라마"와 매칭이 되는 토큰은 다시 R의 "가나다 라마"가 된다.
    // 	// 더이상 확장이 되지 않을 때까지 확장 시도...
    // 	// 참고: 더 쉬운 방법이 있을 것 같아. 이전 엔트리와 다음 엔트리를 확인하면서
    // 	while (true) {
    // 		const newCurrent = getOtherSpan(otherSide, other);
    // 		if (!newCurrent) break;
    // 		const expanded = newCurrent.start < current.start || newCurrent.end > current.end;
    // 		if (!expanded) break;
    // 		current = {
    // 			start: Math.min(current.start, newCurrent.start),
    // 			end: Math.max(current.end, newCurrent.end),
    // 		};
    // 		const newOther = getOtherSpan(side, current);
    // 		if (!newOther) break;
    // 		other = {
    // 			start: Math.min(other.start, newOther.start),
    // 			end: Math.max(other.end, newOther.end),
    // 		};
    // 	}
    // 	return side === "left" ? { left: current, right: other } : { left: other, right: current };
    // }
  }

  function clampRange(range, startAfter, endBefore) {
    try {
      if (startAfter && range.comparePoint(startAfter, 0) >= 0) {
        range.setStartAfter(startAfter);
      }
    } catch (e) {
    }
    try {
      if (endBefore && range.comparePoint(endBefore, 0) <= 0) {
        range.setEndBefore(endBefore);
      }
    } catch (e) {
    }
    return range;
  }

  function getParentElement(node) {
    const element = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
    return element;
  }

  function findClosestContainer(node, selector) {
    return getParentElement(node).closest(selector);
  }

  function getHeadingLevelFromFlag(flag) {
    switch (flag) {
      case TokenFlags.SECTION_HEADING_TYPE1:
        return 0;
      // 1.
      case TokenFlags.SECTION_HEADING_TYPE2:
        return 1;
      // 가.
      case TokenFlags.SECTION_HEADING_TYPE3:
        return 2;
      // (1)
      case TokenFlags.SECTION_HEADING_TYPE4:
        return 3;
      // (가)
      case TokenFlags.SECTION_HEADING_TYPE5:
        return 4;
      // 1)
      case TokenFlags.SECTION_HEADING_TYPE6:
        return 5;
      // 가)
      default:
        return -1;
    }
  }

  function getTableCellPosition(td) {
    if (td.tagName !== "TD") return null;
    const tr = td.parentElement;
    if (!tr || tr.tagName !== "TR") return null;
    const table = tr.parentElement;
    if (!table || table.tagName !== "TABLE") return null;
    const rowIndex = Array.prototype.indexOf.call(table.rows, tr);
    const colIndex = Array.prototype.indexOf.call(tr.cells, td);
    if (rowIndex === -1 || colIndex === -1) return null;
    return [rowIndex, colIndex];
  }

  function parseOrdinalNumber(ordinalText) {
    const norm = ordinalText.replace(/[\(\)\.]/g, "");
    if (/^\d+$/.test(norm)) {
      return Number(norm);
    }
    const idx = HANGUL_ORDER.indexOf(norm);
    if (idx !== -1) {
      return idx + 1;
    }
    return NaN;
  }

  var AnchorFlags = /* @__PURE__ */ ((AnchorFlags2) => {
    AnchorFlags2[AnchorFlags2["None"] = 0] = "None";
    AnchorFlags2[AnchorFlags2["LINE_START"] = 1] = "LINE_START";
    AnchorFlags2[AnchorFlags2["BLOCK_START"] = 2] = "BLOCK_START";
    AnchorFlags2[AnchorFlags2["CONTAINER_START"] = 4] = "CONTAINER_START";
    AnchorFlags2[AnchorFlags2["TABLECELL_START"] = 8] = "TABLECELL_START";
    AnchorFlags2[AnchorFlags2["TABLEROW_START"] = 16] = "TABLEROW_START";
    AnchorFlags2[AnchorFlags2["TABLE_START"] = 32] = "TABLE_START";
    AnchorFlags2[AnchorFlags2["AFTER_CONTAINER"] = 64] = "AFTER_CONTAINER";
    AnchorFlags2[AnchorFlags2["EMPTY_DIFF"] = 128] = "EMPTY_DIFF";
    AnchorFlags2[AnchorFlags2["SECTION_HEADING"] = 256] = "SECTION_HEADING";
    AnchorFlags2[AnchorFlags2["MANUAL_ANCHOR"] = 512] = "MANUAL_ANCHOR";
    return AnchorFlags2;
  })(AnchorFlags || {});
  class EditorPairer {
    static MIN_DELTA = 1;
    static MIN_STRIPED_DELTA = 10;
    static MIN_CHUNK_SIZE = 20;
    #leftEditor;
    #rightEditor;
    #diffMarkers = [];
    #anchorPairs = [];
    #anchorMap = /* @__PURE__ */ new Map();
    #oldAnchorPairs = null;
    #oldDiffMarkers = null;
    #chunkCancellationToken = null;
    #elapsedTotal = 0;
    #unusedAnchors = /* @__PURE__ */ new Set();
    constructor(leftEditor, rightEditor) {
      this.#leftEditor = leftEditor;
      this.#rightEditor = rightEditor;
    }
    cancelAnchorAligning() {
      if (this.#chunkCancellationToken !== null) {
        console.debug("AnchorManager: canceling anchor aligning");
        cancelAnimationFrame(this.#chunkCancellationToken);
        this.#chunkCancellationToken = null;
      }
    }
    beginUpdate() {
      this.cancelAnchorAligning();
      this.#anchorMap.clear();
      if (this.#oldAnchorPairs) {
        this.endUpdate();
      }
      this.#oldDiffMarkers = this.#diffMarkers;
      for (const marker of this.#diffMarkers) {
        if (marker) {
          marker.remove();
        }
      }
      this.#diffMarkers = [];
      this.#oldAnchorPairs = this.#anchorPairs;
      this.#anchorPairs = [];
    }
    endUpdate() {
      if (this.#oldAnchorPairs) {
        for (const anchorPair of this.#oldAnchorPairs) {
          const { leftEl, rightEl } = anchorPair;
          if (!this.#anchorMap.has(leftEl)) {
            leftEl.classList.remove("anchor");
            leftEl.style.removeProperty("--anchor-adjust");
            delete leftEl.dataset.anchorIndex;
            this.#unusedAnchors.add(leftEl);
          }
          if (!this.#anchorMap.has(rightEl)) {
            rightEl.classList.remove("anchor");
            rightEl.style.removeProperty("--anchor-adjust");
            delete rightEl.dataset.anchorIndex;
            this.#unusedAnchors.add(rightEl);
          }
        }
        this.#oldAnchorPairs = null;
      }
      if (this.#oldDiffMarkers) {
        for (const marker of this.#oldDiffMarkers) {
          if (marker) {
            marker.remove();
          }
        }
        this.#oldDiffMarkers = null;
      }
    }
    insertDiffMarker(container, offset) {
      let markerEl = container.childNodes[offset];
      if (markerEl && markerEl.nodeName === DIFF_ELEMENT_NAME) {
        console.warn("Existing diff marker found at offset", offset, "in", container, markerEl);
        return null;
      }
      const insertBefore = markerEl;
      markerEl = document.createElement(DIFF_ELEMENT_NAME);
      container.insertBefore(markerEl, insertBefore);
      this.#diffMarkers.push(markerEl);
      return markerEl;
    }
    addAnchorPair(leftRange, leftFlags, leftDiffEl, rightRange, rightFlags, rightDiffEl, diffIndex) {
      const lastPair = this.#anchorPairs[this.#anchorPairs.length - 1];
      let leftEl = leftDiffEl ?? this.#leftEditor.getAnchorTargetForToken(leftRange, leftFlags);
      if (!leftEl) {
        return;
      } else {
        const lastEl = lastPair?.leftEl;
        if (lastEl && !(lastEl.compareDocumentPosition(leftEl) & Node.DOCUMENT_POSITION_FOLLOWING)) {
          return;
        }
      }
      let rightEl = rightDiffEl ?? this.#rightEditor.getAnchorTargetForToken(rightRange, rightFlags);
      if (!rightEl) {
        return;
      } else {
        const lastEl = lastPair?.rightEl;
        if (lastEl && !(lastEl.compareDocumentPosition(rightEl) & Node.DOCUMENT_POSITION_FOLLOWING)) {
          return;
        }
      }
      const pair = {
        index: this.#anchorPairs.length,
        leftEl,
        rightEl,
        diffIndex,
        flags: leftFlags | rightFlags,
        aligned: false,
        delta: 0,
        leftFlags,
        rightFlags
      };
      leftEl.classList.add("anchor");
      rightEl.classList.add("anchor");
      rightEl.dataset.anchorIndex = leftEl.dataset.anchorIndex = pair.index.toString();
      if (diffIndex !== null) {
        leftEl.dataset.diffIndex = diffIndex.toString();
        rightEl.dataset.diffIndex = diffIndex.toString();
      } else {
        delete leftEl.dataset.diffIndex;
        delete rightEl.dataset.diffIndex;
      }
      this.#anchorPairs.push(pair);
      this.#anchorMap.set(leftEl, pair);
      this.#anchorMap.set(rightEl, pair);
      parseInt(leftEl.style.getPropertyValue("--anchor-adjust")) || 0;
      parseInt(rightEl.style.getPropertyValue("--anchor-adjust")) || 0;
      leftEl.style.removeProperty("--anchor-adjust");
      rightEl.style.removeProperty("--anchor-adjust");
      return pair;
    }
    #processChunk(startIndex, onDone, deadline) {
      const startTime = performance.now();
      const leftEditor = this.#leftEditor;
      const rightEditor = this.#rightEditor;
      leftEditor.forceReflow();
      rightEditor.forceReflow();
      let leftScrollTop = leftEditor.scrollTop;
      let rightScrollTop = rightEditor.scrollTop;
      let leftEditorTop = leftEditor.getBoundingClientRect().y;
      let rightEditorTop = rightEditor.getBoundingClientRect().y;
      let i = startIndex;
      const pairs = this.#anchorPairs;
      let count = 0;
      while (i < pairs.length) {
        const pair = pairs[i];
        const { leftEl, rightEl } = pair;
        let leftY;
        let rightY;
        leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
        rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
        let delta = Math.round(leftY - rightY);
        if (Math.abs(delta) > 1e3) {
          console.warn("AnchorManager.processChunk: large delta detected", { pair, leftY, rightY, delta, leftScrollTop, rightScrollTop });
        }
        if (delta < -1 || delta > EditorPairer.MIN_DELTA) {
          if (pair.delta > 0) {
            rightEl.style.removeProperty("--anchor-adjust");
            void rightEl.offsetHeight;
            rightEditorTop = rightEditor.getBoundingClientRect().y;
            rightScrollTop = rightEditor.scrollTop;
          } else if (pair.delta < 0) {
            leftEl.style.removeProperty("--anchor-adjust");
            void leftEl.offsetHeight;
            leftEditorTop = leftEditor.getBoundingClientRect().y;
            leftScrollTop = leftEditor.scrollTop;
          }
          leftY = leftEl.getBoundingClientRect().y + leftScrollTop - leftEditorTop;
          rightY = rightEl.getBoundingClientRect().y + rightScrollTop - rightEditorTop;
          delta = Math.round(leftY - rightY);
          if (delta < -1 || delta > EditorPairer.MIN_DELTA) {
            if (this.#applyDeltaToPair(pair, delta, true)) {
              leftScrollTop = leftEditor.scrollTop;
              rightScrollTop = rightEditor.scrollTop;
            }
          }
        }
        i++;
        count++;
        if (count >= EditorPairer.MIN_CHUNK_SIZE && // 최소 요만큼 정도는 deadline 무시하고 처리
        (i & 15) === 0 && // 16개마다 한번씩만 deadline 체크
        performance.now() > deadline) {
          break;
        }
      }
      this.#elapsedTotal += performance.now() - startTime;
      if (i < pairs.length) {
        this.#queueProcessChunk(i, onDone);
      } else {
        {
          console.debug("AnchorManager: processed", count, "/", this.#anchorPairs.length, "pairs in", this.#elapsedTotal.toFixed(2), "ms");
        }
        this.#onAlignDone(onDone);
      }
    }
    #queueProcessChunk(startIndex, onDone) {
      this.#chunkCancellationToken = requestAnimationFrame((time) => {
        this.#chunkCancellationToken = null;
        const deadline = time + FRAME_BUDGET_MS;
        this.#processChunk(startIndex, onDone, deadline);
      });
    }
    alignAnchorsGently(onDone, reset = false) {
      this.cancelAnchorAligning();
      this.#elapsedTotal = 0;
      const pairs = this.#anchorPairs;
      if (pairs.length === 0) {
        this.#onAlignDone(onDone);
        return;
      }
      if (reset) {
        for (const pair of pairs) {
          pair.delta = 0;
          pair.leftEl.style.removeProperty("--anchor-adjust");
          pair.rightEl.style.removeProperty("--anchor-adjust");
        }
      }
      this.#queueProcessChunk(0, onDone);
    }
    #onAlignDone(onDone) {
      this.#leftEditor.forceReflow();
      this.#rightEditor.forceReflow();
      const maxHeight = Math.max(this.#leftEditor.contentHeight, this.#rightEditor.contentHeight);
      this.#leftEditor.padHeight(maxHeight);
      this.#rightEditor.padHeight(maxHeight);
      onDone();
    }
    #applyDeltaToPair(pair, delta, reflow) {
      let changed = false;
      if (delta < -1 || delta > EditorPairer.MIN_DELTA) {
        if (pair.delta !== delta) {
          pair.delta = delta;
          changed = true;
        }
        let theEl;
        if (delta > 0) {
          theEl = pair.rightEl;
        } else {
          delta = -delta;
          theEl = pair.leftEl;
        }
        theEl.style.setProperty("--anchor-adjust", `${delta}px`);
        if (theEl.nodeName !== DIFF_ELEMENT_NAME) {
          theEl.classList.toggle("striped", delta >= EditorPairer.MIN_STRIPED_DELTA);
        }
        if (reflow) {
          void theEl.offsetHeight;
        }
      }
      return changed;
    }
  }

  function translateTokenFlagsToAnchorFlags(tokenFlags, endTokenFlags) {
    let flags = 0;
    if (tokenFlags & TokenFlags.LINE_START) {
      flags |= AnchorFlags.LINE_START;
    }
    if (tokenFlags & TokenFlags.CONTAINER_START) {
      flags |= AnchorFlags.CONTAINER_START;
    }
    if (tokenFlags & TokenFlags.TABLE_START) {
      flags |= AnchorFlags.TABLE_START;
    }
    if (tokenFlags & TokenFlags.TABLEROW_START) {
      flags |= AnchorFlags.TABLEROW_START;
    }
    if (tokenFlags & TokenFlags.TABLECELL_START) {
      flags |= AnchorFlags.TABLECELL_START;
    }
    if (tokenFlags & TokenFlags.BLOCK_START) {
      flags |= AnchorFlags.BLOCK_START;
    }
    if (tokenFlags & TokenFlags.SECTION_HEADING_MASK) ;
    return flags;
  }

  class DiffPostProcessor {
    // #ctx: DiffContext;
    #leftEditor;
    #rightEditor;
    #editorPairer;
    #cancelled = false;
    #ricCancelId = null;
    #entries = null;
    #leftEntries = null;
    #rightEntries = null;
    #leftSectionHeadings = null;
    #rightSectionHeadings = null;
    #diffs = [];
    #leftTokens;
    #rightTokens;
    #diffOptions;
    #rawDiffs;
    constructor(leftEditor, rightEditor, editorPairer, rawDiffs, diffOptions) {
      this.#leftEditor = leftEditor;
      this.#rightEditor = rightEditor;
      this.#editorPairer = editorPairer;
      this.#rawDiffs = rawDiffs;
      this.#diffOptions = diffOptions;
      this.#leftTokens = leftEditor.tokens;
      this.#rightTokens = rightEditor.tokens;
    }
    cancel() {
      this.#cancelled = true;
      if (this.#ricCancelId) {
        cancelIdleCallback(this.#ricCancelId);
        this.#ricCancelId = null;
      }
    }
    process(onComplete) {
      let generator = null;
      const step = (idleDeadline) => {
        if (this.#cancelled) {
          return;
        }
        if (generator === null) {
          generator = this.#processGenerator(idleDeadline);
        }
        const { done } = generator.next(idleDeadline);
        if (this.#cancelled) {
          return;
        }
        if (done) {
          const diffContext = new DiffContext(
            this.#leftTokens,
            this.#rightTokens,
            this.#diffOptions,
            this.#rawDiffs,
            this.#entries,
            this.#leftEntries,
            this.#rightEntries,
            this.#diffs,
            this.#leftSectionHeadings,
            this.#rightSectionHeadings
          );
          onComplete?.(diffContext);
        } else {
          this.#ricCancelId = requestIdleCallback(step, {
            timeout: COMPUTE_DIFF_TIMEOUT
          });
        }
      };
      this.#ricCancelId = requestIdleCallback(step, {
        timeout: COMPUTE_DIFF_TIMEOUT
      });
    }
    *#processGenerator(idleDeadline) {
      this.#buildDiffEntries();
      if (idleDeadline.timeRemaining() <= 0) {
        idleDeadline = yield;
      }
      const entries = this.#entries;
      this.#editorPairer.beginUpdate();
      this.#leftSectionHeadings = this.#buildSectionHeadingTree(this.#leftEditor, this.#leftTokens);
      this.#rightSectionHeadings = this.#buildSectionHeadingTree(this.#rightEditor, this.#rightTokens);
      for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
        if ((entryIndex & 31) === 0) {
          if (idleDeadline.timeRemaining() < 3) {
            idleDeadline = yield;
          }
        }
        if (entries[entryIndex].type === 0) {
          this.#handleCommonEntry(entryIndex);
        } else {
          this.#handleDiffEntry(entryIndex);
        }
      }
      this.#editorPairer.endUpdate();
    }
    #handleCommonEntry(entryIndex) {
      const { left, right } = this.#entries[entryIndex];
      const leftTokens = this.#leftTokens;
      const rightTokens = this.#rightTokens;
      const leftToken = leftTokens[left.start];
      const rightToken = rightTokens[right.start];
      const commonFlags = leftToken.flags & rightToken.flags;
      if (commonFlags & TokenFlags.LINE_START) {
        const leftAnchorFlags = translateTokenFlagsToAnchorFlags(leftToken.flags, leftTokens[left.end - 1].flags);
        const rightAnchorFlags = translateTokenFlagsToAnchorFlags(rightToken.flags, rightTokens[right.end - 1].flags);
        this.#editorPairer.addAnchorPair(leftToken.range, leftAnchorFlags, null, rightToken.range, rightAnchorFlags, null, null);
      }
    }
    #handleDiffEntry(entryIndex) {
      const leftTokens = this.#leftTokens;
      const rightTokens = this.#rightTokens;
      const entries = this.#entries;
      const diffs = this.#diffs;
      const diffIndex = diffs.length;
      const entry = entries[entryIndex];
      const { left, right } = entry;
      const { start: leftStart, end: leftEnd } = left;
      const { start: rightStart, end: rightEnd } = right;
      const leftTokenCount = leftEnd - leftStart;
      const rightTokenCount = rightEnd - rightStart;
      const leftToken = leftTokens[leftStart];
      const rightToken = rightTokens[rightStart];
      const hue = DIFF_COLOR_HUES[diffIndex % NUM_DIFF_COLORS];
      let leftRange = this.#leftEditor.getTokenRange(leftStart, leftEnd);
      let rightRange = this.#rightEditor.getTokenRange(rightStart, rightEnd);
      let leftMarkerEl = null;
      let rightMarkerEl = null;
      let leftAnchorFlags = 0;
      let rightAnchorFlags = 0;
      if (leftTokenCount > 0 && rightTokenCount > 0) {
        const commonFlags = leftToken.flags & rightToken.flags;
        if (commonFlags & TokenFlags.LINE_START) {
          leftAnchorFlags = translateTokenFlagsToAnchorFlags(leftToken.flags, leftTokens[leftStart + leftTokenCount - 1].flags);
          rightAnchorFlags = translateTokenFlagsToAnchorFlags(rightToken.flags, rightTokens[rightStart + rightTokenCount - 1].flags);
          this.#editorPairer.addAnchorPair(leftRange, leftAnchorFlags, null, rightRange, rightAnchorFlags, null, diffIndex);
        }
      } else {
        let filledTokens, emptyTokens;
        let emptyRange = null;
        let filledSpan;
        let emptySpan;
        let markerEl = null;
        if (leftTokenCount > 0) {
          this.#leftEditor;
          filledSpan = left;
          filledTokens = this.#leftEditor.tokens;
          this.#rightEditor;
          emptySpan = right;
          emptyTokens = this.#rightEditor.tokens;
          emptyRange = rightRange;
        } else {
          this.#rightEditor;
          filledSpan = right;
          filledTokens = this.#rightEditor.tokens;
          this.#leftEditor;
          emptySpan = left;
          emptyTokens = this.#leftEditor.tokens;
          emptyRange = leftRange;
        }
        const filledTokenIndex = filledSpan.start;
        const filledTokenEnd = filledSpan.end;
        const filledTokenCount = filledTokenEnd - filledTokenIndex;
        const filledStartToken = filledTokens[filledTokenIndex];
        const filledEndToken = filledTokens[filledTokenIndex + filledTokenCount - 1];
        let emptyFlags = 0;
        let insertionPoint = null;
        if (filledStartToken.flags & TokenFlags.TABLE_START) {
          const targetRange = this.#clampToSafeBoundary(emptyRange, "table", entryIndex, filledTokens, filledSpan, emptyTokens, emptySpan);
          if (targetRange) {
            insertionPoint = this.#getInsertionPoint(targetRange, TokenFlags.TABLE_START);
          }
        }
        if (!insertionPoint && filledStartToken.flags & TokenFlags.TABLEROW_START) {
          const targetRange = this.#clampToSafeBoundary(emptyRange, "tr", entryIndex, filledTokens, filledSpan, emptyTokens, emptySpan);
          if (targetRange) {
            insertionPoint = this.#getInsertionPoint(targetRange, TokenFlags.TABLEROW_START);
          }
        }
        if (!insertionPoint && filledStartToken.flags & TokenFlags.TABLECELL_START) {
          const targetRange = this.#clampToSafeBoundary(emptyRange, "td", entryIndex, filledTokens, filledSpan, emptyTokens, emptySpan);
          if (targetRange) {
            insertionPoint = this.#getInsertionPoint(targetRange, TokenFlags.TABLECELL_START);
          }
        }
        if (!insertionPoint && filledStartToken.flags & TokenFlags.LINE_START) {
          insertionPoint = this.#getInsertionPoint(emptyRange, TokenFlags.LINE_START);
        }
        if (insertionPoint) {
          markerEl = this.#editorPairer.insertDiffMarker(insertionPoint[0], insertionPoint[1]);
          if (markerEl) {
            markerEl.classList.add("diff");
            markerEl.classList.toggle("block", !!(filledStartToken.flags & TokenFlags.LINE_START && filledEndToken.flags & TokenFlags.LINE_END));
            markerEl.dataset.diffIndex = diffIndex.toString();
            emptyFlags = insertionPoint[2];
            emptyRange.selectNode(markerEl);
            if (leftTokenCount > 0) {
              rightMarkerEl = markerEl;
            } else {
              leftMarkerEl = markerEl;
            }
          }
        }
        if (markerEl) {
          const commonFlags = filledStartToken.flags & emptyFlags;
          if (commonFlags & TokenFlags.LINE_START) {
            leftAnchorFlags = translateTokenFlagsToAnchorFlags(filledStartToken.flags, filledEndToken.flags);
            rightAnchorFlags = translateTokenFlagsToAnchorFlags(emptyFlags);
          }
        }
      }
      diffs.push({
        diffIndex,
        hue,
        leftRange,
        rightRange,
        leftSpan: { start: leftStart, end: leftStart + leftTokenCount },
        rightSpan: { start: rightStart, end: rightStart + rightTokenCount },
        leftMarkerEl,
        rightMarkerEl
      });
    }
    #getInsertionPoint(targetRange, desiredFlag) {
      let container;
      let childIndex;
      let endContainer;
      let endOffset;
      container = targetRange.startContainer;
      childIndex = targetRange.startOffset;
      endContainer = targetRange.endContainer;
      endOffset = targetRange.endOffset;
      if (container.nodeType === 3) {
        childIndex = Array.prototype.indexOf.call(container.parentNode.childNodes, container) + 1;
        container = container.parentNode;
      }
      if (endContainer.nodeType === 3) {
        endOffset = Array.prototype.indexOf.call(endContainer.parentNode.childNodes, endContainer);
        endContainer = endContainer.parentNode;
      }
      const indexStack = [];
      let isTextlessContainer = TEXTLESS_ELEMENTS[container.nodeName] || false;
      while (container) {
        let current = container.childNodes[childIndex];
        if (!isTextlessContainer) {
          if (desiredFlag & TokenFlags.TABLE_START) {
            if (container.nodeName === "TD" && childIndex === 0) {
              const rowcol = getTableCellPosition(container);
              if (rowcol && rowcol[0] === 0 && rowcol[1] === 0) {
                return [
                  container,
                  childIndex,
                  TokenFlags.TABLE_START | TokenFlags.TABLEROW_START | TokenFlags.TABLECELL_START | TokenFlags.LINE_START
                ];
              }
            }
          } else if (desiredFlag & TokenFlags.TABLEROW_START) {
            if (container.nodeName === "TD" && childIndex === 0) {
              const rowcol = getTableCellPosition(container);
              if (rowcol && rowcol[1] === 0) {
                return [container, childIndex, TokenFlags.TABLEROW_START | TokenFlags.TABLECELL_START | TokenFlags.LINE_START];
              }
            }
          } else if (desiredFlag & TokenFlags.TABLECELL_START) {
            if (container.nodeName === "TD" && childIndex === 0) {
              return [container, childIndex, TokenFlags.TABLECELL_START | TokenFlags.LINE_START];
            }
          } else if (desiredFlag & TokenFlags.LINE_START) {
            if (childIndex === 0) {
              if (BLOCK_ELEMENTS[container.nodeName]) {
                return [container, childIndex, TokenFlags.LINE_START];
              }
            } else {
              const prev = container.childNodes[childIndex - 1];
              if (prev.nodeName === "BR" || prev.nodeName === "HR" || BLOCK_ELEMENTS[prev.nodeName]) {
                return [container, childIndex, TokenFlags.LINE_START];
              }
            }
          }
        }
        if (container === endContainer && childIndex >= endOffset) {
          break;
        }
        if (!current) {
          current = container;
          container = container.parentNode;
          isTextlessContainer = TEXTLESS_ELEMENTS[container.nodeName] || false;
          if (indexStack.length > 0) {
            childIndex = indexStack.pop();
          } else {
            childIndex = Array.prototype.indexOf.call(container.childNodes, current);
          }
          childIndex++;
          continue;
        }
        if (current.nodeType === 1 && !VOID_ELEMENTS[current.nodeName]) {
          indexStack.push(childIndex);
          container = current;
          isTextlessContainer = TEXTLESS_ELEMENTS[container.nodeName] || false;
          childIndex = 0;
          continue;
        }
        childIndex++;
      }
      return null;
    }
    #clampToSafeBoundary(range, level, entryIndex, filledTokens, filledSpan, emptyTokens, emptySpan) {
      const entries = this.#entries;
      let commonPrevFlags = 0;
      let commonNextFlags = 0;
      let emptyLast;
      let emptyNext;
      if (entryIndex > 0) {
        const prevEntry = entries[entryIndex - 1];
        if (prevEntry.type === 0) {
          const filledLast = filledTokens[filledSpan.end - 1];
          emptyLast = emptyTokens[emptySpan.end - 1];
          commonPrevFlags = (filledLast?.flags ?? 0) & (emptyLast?.flags ?? 0);
        }
      }
      if (entryIndex < entries.length) {
        const filledNext = filledTokens[filledSpan.end];
        emptyNext = emptyTokens[emptySpan.start];
        commonNextFlags = (filledNext?.flags ?? 0) & (emptyNext?.flags ?? 0);
      }
      let clampAfter = null;
      let clampBefore = null;
      if (level === "table") {
        if (commonPrevFlags & TokenFlags.TABLE_END) {
          const endNode = emptyLast.range.endContainer;
          clampAfter = findClosestContainer(endNode, "table");
        }
        if (commonNextFlags & TokenFlags.TABLE_START) {
          const startNode = emptyNext.range.startContainer;
          clampBefore = findClosestContainer(startNode, "table");
        }
      } else if (level === "tr") {
        if (commonPrevFlags & TokenFlags.TABLEROW_END) {
          const endNode = emptyLast.range.endContainer;
          clampAfter = findClosestContainer(endNode, "tr");
        }
        if (commonNextFlags & TokenFlags.TABLEROW_START) {
          const startNode = emptyNext.range.startContainer;
          clampBefore = findClosestContainer(startNode, "tr");
        }
      } else if (level === "td") {
        if (commonPrevFlags & TokenFlags.TABLECELL_END) {
          const endNode = emptyLast.range.endContainer;
          clampAfter = findClosestContainer(endNode, "td");
        }
        if (commonNextFlags & TokenFlags.TABLECELL_START) {
          const startNode = emptyNext.range.startContainer;
          clampBefore = findClosestContainer(startNode, "td");
        }
      } else ;
      if (clampAfter || clampBefore) {
        const cloned = range.cloneRange();
        return clampRange(cloned, clampAfter, clampBefore);
      } else {
        return range;
      }
    }
    #buildDiffEntries() {
      const entries = [];
      const leftEntries = new Array(this.#leftTokens.length);
      const rightEntries = new Array(this.#rightTokens.length);
      const rawDiffs = this.#rawDiffs;
      let currentDiff = null;
      for (let i = 0; i < rawDiffs.length; i++) {
        const rawEntry = rawDiffs[i];
        const { left, right, type } = rawEntry;
        if (type) {
          if (currentDiff) {
            console.assert(currentDiff.left.end === left.start, currentDiff, rawEntry);
            console.assert(currentDiff.right.end === right.start, currentDiff, rawEntry);
            currentDiff.type |= type;
            currentDiff.left.end = left.end;
            currentDiff.right.end = right.end;
          } else {
            currentDiff = { left: { ...left }, right: { ...right }, type };
          }
        } else {
          if (currentDiff) {
            entries.push(currentDiff);
            for (let j = currentDiff.left.start; j < currentDiff.left.end; j++) {
              leftEntries[j] = currentDiff;
            }
            for (let j = currentDiff.right.start; j < currentDiff.right.end; j++) {
              rightEntries[j] = currentDiff;
            }
            currentDiff = null;
          }
          entries.push(rawEntry);
          for (let j = left.start; j < left.end; j++) {
            leftEntries[j] = rawEntry;
          }
          for (let j = right.start; j < right.end; j++) {
            rightEntries[j] = rawEntry;
          }
        }
      }
      if (currentDiff) {
        entries.push(currentDiff);
        for (let j = currentDiff.left.start; j < currentDiff.left.end; j++) {
          leftEntries[j] = currentDiff;
        }
        for (let j = currentDiff.right.start; j < currentDiff.right.end; j++) {
          rightEntries[j] = currentDiff;
        }
      }
      this.#entries = entries;
      this.#leftEntries = leftEntries;
      this.#rightEntries = rightEntries;
    }
    #buildSectionHeadingTree(editor, tokens) {
      const rootHeadings = [];
      const stack = [];
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const headingFlag = token.flags & TokenFlags.SECTION_HEADING_MASK;
        if (!headingFlag) continue;
        const level = getHeadingLevelFromFlag(headingFlag);
        const ordinalText = token.text;
        const ordinalNum = parseOrdinalNumber(ordinalText);
        let titleEndTokenIndex = i;
        while (titleEndTokenIndex < tokens.length && (tokens[titleEndTokenIndex++].flags & TokenFlags.LINE_END) === 0) ;
        const tokenRange = editor.getTokenRange(i + 1, titleEndTokenIndex);
        const title = tokenRange.toString();
        const heading = {
          type: headingFlag,
          level,
          ordinalText,
          ordinalNum,
          title,
          parent: null,
          firstChild: null,
          nextSibling: null,
          startTokenIndex: i,
          endTokenIndex: Number.MAX_SAFE_INTEGER
          // temp
        };
        while (stack.length > 0 && heading.level <= stack[stack.length - 1].level) {
          const closed = stack.pop();
          closed.endTokenIndex = heading.startTokenIndex;
        }
        if (stack.length === 0) {
          rootHeadings.push(heading);
        } else {
          const parent = stack[stack.length - 1];
          heading.parent = parent;
          if (!parent.firstChild) {
            parent.firstChild = heading;
          } else {
            let sibling = parent.firstChild;
            while (sibling.nextSibling) sibling = sibling.nextSibling;
            sibling.nextSibling = heading;
          }
        }
        stack.push(heading);
      }
      for (const remaining of stack) {
        remaining.endTokenIndex = tokens.length;
      }
      return rootHeadings;
    }
  }

  const jsContent = '(function () {\n    \'use strict\';\n\n    const HANGUL_ORDER = "가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허";\n\n    function createTrie(ignoreSpaces = false) {\n      const root = createTrieNode(ignoreSpaces);\n      function insert(word, flags = 0) {\n        let node = root;\n        for (let i = 0; i < word.length; i++) {\n          node = node.addChild(word[i]);\n        }\n        node.word = word;\n        node.flags = flags;\n      }\n      return { insert, root };\n    }\n    function createTrieNode(ignoreSpaces) {\n      const children = {};\n      const node = {\n        children,\n        word: null,\n        flags: 0,\n        next(char) {\n          if (ignoreSpaces && char === " ") return node;\n          return children[char] || null;\n        },\n        addChild(char) {\n          return children[char] ?? (children[char] = createTrieNode(ignoreSpaces));\n        }\n      };\n      return node;\n    }\n    function extractStartCharsFromTrie(trie) {\n      const table = {};\n      for (const ch in trie.children) {\n        table[ch] = 1;\n      }\n      return table;\n    }\n\n    ((normChars) => {\n      const result = {};\n      function getCharCode(char) {\n        if (typeof char === "number") {\n          return char;\n        }\n        return char.codePointAt(0);\n      }\n      for (const entry of normChars) {\n        const [norm, ...variants] = entry;\n        const normCharCode = getCharCode(norm);\n        for (const variant of variants) {\n          const variantCharCode = getCharCode(variant);\n          result[variantCharCode] = normCharCode;\n        }\n      }\n      return result;\n    })([\n      [\'"\', "“", "”", "\'", "‘", "’"],\n      // 비즈플랫폼 편집기에서 작은따옴표를 큰따옴표로 바꾸어버림. WHY?\n      ["-", "‐", "‑", "‒", "–", "﹘", "—", "－"],\n      [".", "․", "．"],\n      [",", "，"],\n      ["•", "●"],\n      // 이걸 중간점 용도로 쓰는 사람들은 정말 갈아마셔야된다. 도저히 용납해줄 수 없고 같은 문자로 인식하게 만들고 싶지 않다.\n      ["◦", "○", "ㅇ"],\n      // 자음 "이응"을 쓰는 사람들도 개인적으로 이해가 안되지만 많더라.\n      ["■", "▪", "◼"],\n      ["□", "▫", "◻", "ㅁ"],\n      ["·", "⋅", "∙", "ㆍ", "‧"],\n      // 유니코드를 만든 집단은 도대체 무슨 생각이었던걸까?...\n      ["…", "⋯"],\n      ["(", "（"],\n      [")", "）"],\n      ["[", "［"],\n      ["]", "］"],\n      ["{", "｛"],\n      ["}", "｝"],\n      ["<", "＜"],\n      [">", "＞"],\n      ["=", "＝"],\n      ["+", "＋"],\n      ["*", "＊", "✱", "×", "∗"],\n      ["/", "／", "÷"],\n      ["\\\\", "₩"],\n      // 아마도 원화 기호로 사용했겠지\n      ["&", "＆"],\n      ["#", "＃"],\n      ["@", "＠"],\n      ["$", "＄"],\n      ["%", "％"],\n      ["^", "＾"],\n      ["~", "～"],\n      ["`", "｀"],\n      ["|", "｜"],\n      [":", "："],\n      [";", "；"],\n      ["?", "？"],\n      ["!", "！"],\n      ["_", "＿"],\n      ["→", "⇒", "➡", "➔", "➞", "➟"],\n      ["←", "⇐", "⬅", "⟵", "⟸"],\n      ["↑", "⇑", "⬆"],\n      ["↓", "⇓", "⬇"],\n      ["↔", "⇔"],\n      ["↕", "⇕"],\n      [" ", " "],\n      ["0", "😒"]\n    ]);\n\n    var TokenFlags = /* @__PURE__ */ ((TokenFlags2) => {\n      TokenFlags2[TokenFlags2["None"] = 0] = "None";\n      TokenFlags2[TokenFlags2["LINE_START"] = 1] = "LINE_START";\n      TokenFlags2[TokenFlags2["LINE_END"] = 2] = "LINE_END";\n      TokenFlags2[TokenFlags2["BLOCK_START"] = 4] = "BLOCK_START";\n      TokenFlags2[TokenFlags2["BLOCK_END"] = 8] = "BLOCK_END";\n      TokenFlags2[TokenFlags2["CONTAINER_START"] = 16] = "CONTAINER_START";\n      TokenFlags2[TokenFlags2["CONTAINER_END"] = 32] = "CONTAINER_END";\n      TokenFlags2[TokenFlags2["TABLE_START"] = 64] = "TABLE_START";\n      TokenFlags2[TokenFlags2["TABLE_END"] = 128] = "TABLE_END";\n      TokenFlags2[TokenFlags2["TABLEROW_START"] = 256] = "TABLEROW_START";\n      TokenFlags2[TokenFlags2["TABLEROW_END"] = 512] = "TABLEROW_END";\n      TokenFlags2[TokenFlags2["TABLECELL_START"] = 1024] = "TABLECELL_START";\n      TokenFlags2[TokenFlags2["TABLECELL_END"] = 2048] = "TABLECELL_END";\n      TokenFlags2[TokenFlags2["NO_JOIN_PREV"] = 4096] = "NO_JOIN_PREV";\n      TokenFlags2[TokenFlags2["NO_JOIN_NEXT"] = 8192] = "NO_JOIN_NEXT";\n      TokenFlags2[TokenFlags2["WILD_CARD"] = 16384] = "WILD_CARD";\n      TokenFlags2[TokenFlags2["MANUAL_ANCHOR"] = 32768] = "MANUAL_ANCHOR";\n      TokenFlags2[TokenFlags2["IMAGE"] = 65536] = "IMAGE";\n      TokenFlags2[TokenFlags2["HTML_SUP"] = 131072] = "HTML_SUP";\n      TokenFlags2[TokenFlags2["HTML_SUB"] = 262144] = "HTML_SUB";\n      TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE1"] = 524288] = "SECTION_HEADING_TYPE1";\n      TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE2"] = 1048576] = "SECTION_HEADING_TYPE2";\n      TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE3"] = 2097152] = "SECTION_HEADING_TYPE3";\n      TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE4"] = 4194304] = "SECTION_HEADING_TYPE4";\n      TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE5"] = 8388608] = "SECTION_HEADING_TYPE5";\n      TokenFlags2[TokenFlags2["SECTION_HEADING_TYPE6"] = 16777216] = "SECTION_HEADING_TYPE6";\n      TokenFlags2[TokenFlags2["SECTION_HEADING_MASK"] = 33030144] = "SECTION_HEADING_MASK";\n      return TokenFlags2;\n    })(TokenFlags || {});\n    const wildcardTrie = createTrie(true);\n    wildcardTrie.insert("(추가)", 16384 /* WILD_CARD */);\n    wildcardTrie.insert("(삭제)", 16384 /* WILD_CARD */);\n    wildcardTrie.insert("(신설)", 16384 /* WILD_CARD */);\n    wildcardTrie.insert("(생략)", 16384 /* WILD_CARD */);\n    wildcardTrie.insert("(현행과같음)", 16384 /* WILD_CARD */);\n    wildcardTrie.root.next("(");\n    const sectionHeadingTrie = createTrie(false);\n    for (let i = 1; i < 40; i++) {\n      sectionHeadingTrie.insert(`${i}.`, 524288 /* SECTION_HEADING_TYPE1 */);\n      sectionHeadingTrie.insert(`(${i})`, 2097152 /* SECTION_HEADING_TYPE3 */);\n      sectionHeadingTrie.insert(`${i})`, 8388608 /* SECTION_HEADING_TYPE5 */);\n    }\n    for (let i = 0; i < HANGUL_ORDER.length; i++) {\n      sectionHeadingTrie.insert(`${HANGUL_ORDER[i]}.`, 1048576 /* SECTION_HEADING_TYPE2 */);\n      sectionHeadingTrie.insert(`(${HANGUL_ORDER[i]})`, 4194304 /* SECTION_HEADING_TYPE4 */);\n      sectionHeadingTrie.insert(`${HANGUL_ORDER[i]})`, 16777216 /* SECTION_HEADING_TYPE6 */);\n    }\n    const SectionHeadingTrieNode = sectionHeadingTrie.root;\n    extractStartCharsFromTrie(SectionHeadingTrieNode);\n\n    let _nextCtx = null;\n    let _currentCtx = null;\n    self.onmessage = (e) => {\n      if (e.data.type === "diff") {\n        const request = e.data;\n        const ctx = {\n          ...request,\n          cancel: false,\n          start: 0,\n          finish: 0,\n          lastYield: 0,\n          entries: [],\n          states: {}\n        };\n        if (ctx.leftTokens === null) {\n          ctx.leftTokens = _currentCtx.leftTokens;\n        }\n        if (ctx.rightTokens === null) {\n          ctx.rightTokens = _currentCtx.rightTokens;\n        }\n        if (_currentCtx) {\n          _currentCtx.cancel = true;\n          _nextCtx = ctx;\n          return;\n        }\n        runDiff(ctx);\n      } else if (e.data.type === "slice") {\n        if (_currentCtx) {\n          self.postMessage({\n            reqId: e.data.reqId,\n            type: "slice",\n            accepted: false\n          });\n          return;\n        }\n        const ctx = {\n          reqId: e.data.reqId,\n          type: "slice",\n          cancel: false,\n          leftTokens: tokenizeSimple(e.data.leftText),\n          rightTokens: tokenizeSimple(e.data.rightText),\n          start: 0,\n          finish: 0,\n          lastYield: 0,\n          options: e.data.options,\n          entries: [],\n          states: {}\n        };\n        runDiff(ctx);\n      }\n    };\n    function tokenizeSimple(text) {\n      const len = text.length;\n      const result = new Array(len);\n      for (let i = 0; i < len; i++) {\n        result[i] = { text: text[i], flags: 0 };\n      }\n      return result;\n    }\n    async function runDiff(ctx) {\n      _currentCtx = ctx;\n      try {\n        ctx.lastYield = ctx.start = performance.now();\n        self.postMessage({\n          reqId: ctx.reqId,\n          type: "start",\n          start: ctx.start\n        });\n        let result;\n        if (ctx.options.algorithm === "histogram") {\n          result = await runHistogramDiff(ctx);\n        } else if (ctx.options.algorithm === "lcs") {\n          result = await runLcsDiff(ctx);\n        } else {\n          throw new Error("Unknown algorithm: " + ctx.options.algorithm);\n        }\n        ctx.finish = performance.now();\n        _currentCtx = null;\n        if (ctx.type === "diff") {\n          self.postMessage({\n            reqId: ctx.reqId,\n            type: ctx.type,\n            processTime: ctx.finish - ctx.start,\n            diffs: result,\n            options: ctx.options\n          });\n        } else if (ctx.type === "slice") {\n          self.postMessage({\n            reqId: ctx.reqId,\n            type: ctx.type,\n            accepted: true,\n            processTime: ctx.finish - ctx.start,\n            diffs: result,\n            options: ctx.options\n          });\n        }\n      } catch (e) {\n        if (e instanceof Error && e.message === "cancelled") ; else {\n          console.error(e);\n        }\n      }\n      [ctx, _nextCtx] = [_nextCtx, null];\n      if (ctx) {\n        return await runDiff(ctx);\n      }\n    }\n    async function runLcsDiff(ctx) {\n      const lhsTokens = ctx.leftTokens;\n      const rhsTokens = ctx.rightTokens;\n      const rawResult = await computeDiff(lhsTokens, rhsTokens, !!ctx.options.greedyMatch, ctx);\n      return rawResult;\n    }\n    async function computeLCS(leftTokens, rightTokens, ctx) {\n      const m = leftTokens.length;\n      const n = rightTokens.length;\n      const dp = new Array(m + 1);\n      for (let i2 = 0; i2 <= m; i2++) {\n        dp[i2] = new Array(n + 1).fill(0);\n      }\n      for (let i2 = 1; i2 <= m; i2++) {\n        const leftText = leftTokens[i2 - 1].text;\n        for (let j2 = 1; j2 <= n; j2++) {\n          if (ctx && (i2 + j2 & 16383) === 0) {\n            const now = performance.now();\n            if (now - ctx.lastYield > 50) {\n              ctx.lastYield = now;\n              await new Promise((resolve) => setTimeout(resolve, 0));\n              if (ctx.cancel) {\n                throw new Error("cancelled");\n              }\n            }\n          }\n          if (leftText === rightTokens[j2 - 1].text) {\n            dp[i2][j2] = dp[i2 - 1][j2 - 1] + 1;\n          } else {\n            dp[i2][j2] = Math.max(dp[i2 - 1][j2], dp[i2][j2 - 1]);\n          }\n        }\n      }\n      let i = m;\n      let j = n;\n      const lcsIndices = [];\n      while (i > 0 && j > 0) {\n        if (leftTokens[i - 1].text === rightTokens[j - 1].text) {\n          lcsIndices.push({\n            leftIndex: i - 1,\n            rightIndex: j - 1\n          });\n          i--;\n          j--;\n        } else if (dp[i - 1][j] >= dp[i][j - 1]) {\n          i--;\n        } else {\n          j--;\n        }\n      }\n      lcsIndices.reverse();\n      return lcsIndices;\n    }\n    async function computeDiff(lhsTokens, rhsTokens, greedyMatch = false, ctx) {\n      const entries = [];\n      const lcs = await computeLCS(lhsTokens, rhsTokens, ctx);\n      const lcsLength = lcs.length;\n      const leftTokensLength = lhsTokens.length;\n      const rightTokensLength = rhsTokens.length;\n      if (leftTokensLength === 0 && rightTokensLength === 0) ; else if (leftTokensLength === 0) {\n        entries.push({\n          type: 2,\n          left: {\n            start: 0,\n            end: leftTokensLength\n            // empty: true,\n          },\n          right: {\n            start: 0,\n            end: rightTokensLength\n          }\n        });\n      } else if (rightTokensLength === 0) {\n        entries.push({\n          type: 1,\n          left: {\n            start: 0,\n            end: leftTokensLength\n          },\n          right: {\n            start: 0,\n            end: rightTokensLength\n            // empty: true,\n          }\n        });\n      } else {\n        let i = 0;\n        let j = 0;\n        let lcsIndex = 0;\n        let iteration = 0;\n        while (lcsIndex < lcsLength || i < leftTokensLength || j < rightTokensLength) {\n          if (ctx && (iteration & 1023) === 0) {\n            const now = performance.now();\n            if (now - ctx.lastYield > 100) {\n              ctx.lastYield = now;\n              await new Promise((resolve) => setTimeout(resolve, 0));\n              if (ctx.cancel) {\n                throw new Error("cancelled");\n              }\n            }\n          }\n          if (lcsIndex < lcsLength && (greedyMatch && lhsTokens[i].text === lhsTokens[lcs[lcsIndex].leftIndex].text && rhsTokens[j].text === rhsTokens[lcs[lcsIndex].rightIndex].text || i === lcs[lcsIndex].leftIndex && j === lcs[lcsIndex].rightIndex)) {\n            entries.push({\n              type: 0,\n              left: {\n                start: i,\n                end: i + 1\n              },\n              right: {\n                start: j,\n                end: j + 1\n              }\n            });\n            i++;\n            j++;\n            lcsIndex++;\n            continue;\n          }\n          const lcsEntry = lcs[lcsIndex];\n          while (i < leftTokensLength && // 유효한 토큰 index\n          (!lcsEntry || // 공통 sequence가 없는 경우\n          !greedyMatch && i < lcsEntry.leftIndex || // 정확한 lcsIndex에만 매칭시키는 경우\n          lhsTokens[i].text !== lhsTokens[lcsEntry.leftIndex].text)) {\n            entries.push({\n              type: 1,\n              left: {\n                start: i,\n                end: i + 1\n              },\n              right: {\n                start: j,\n                end: j\n              }\n            });\n            i++;\n          }\n          while (j < rightTokensLength && // 유효한 토큰 index\n          (!lcsEntry || // 공통 sequence가 없는 경우\n          !greedyMatch && j < lcsEntry.rightIndex || // 정확한 lcsIndex에만 매칭시키는 경우\n          rhsTokens[j].text !== rhsTokens[lcsEntry.rightIndex].text)) {\n            entries.push({\n              type: 2,\n              left: {\n                start: i,\n                end: i\n              },\n              right: {\n                start: j,\n                end: j + 1\n              }\n            });\n            j++;\n          }\n        }\n      }\n      return entries;\n    }\n    async function runHistogramDiff(ctx) {\n      const lhsTokens = ctx.leftTokens;\n      const rhsTokens = ctx.rightTokens;\n      let leftAnchors = [];\n      let rightAnchors = [];\n      for (let i = 0; i < lhsTokens.length; i++) {\n        if (lhsTokens[i].flags & TokenFlags.MANUAL_ANCHOR) {\n          leftAnchors.push(i);\n        }\n      }\n      if (leftAnchors.length > 0) {\n        for (let i = 0; i < rhsTokens.length; i++) {\n          if (rhsTokens[i].flags & TokenFlags.MANUAL_ANCHOR) {\n            rightAnchors.push(i);\n          }\n        }\n      }\n      const matches = [];\n      if (rightAnchors.length > 0) {\n        let rightPos = 0;\n        for (let l = 0; l < leftAnchors.length; l++) {\n          const leftTokenIndex = leftAnchors[l];\n          for (let r = rightPos; r < rightAnchors.length; r++) {\n            const rightTokenIndex = rightAnchors[r];\n            if (lhsTokens[leftTokenIndex].text === rhsTokens[rightTokenIndex].text) {\n              matches.push({ lhsIndex: leftTokenIndex, rhsIndex: rightTokenIndex });\n              rightPos = r + 1;\n              break;\n            }\n          }\n        }\n      }\n      let prevLhs = 0;\n      let prevRhs = 0;\n      for (const match of matches) {\n        const lhsAnchor = match.lhsIndex;\n        const rhsAnchor = match.rhsIndex;\n        if (prevLhs < lhsAnchor || prevRhs < rhsAnchor) {\n          await diffCore(ctx, lhsTokens, prevLhs, lhsAnchor, rhsTokens, prevRhs, rhsAnchor, findBestHistogramAnchor);\n        }\n        ctx.entries.push({\n          type: 0,\n          left: {\n            start: lhsAnchor,\n            end: lhsAnchor + 1\n          },\n          right: {\n            start: rhsAnchor,\n            end: rhsAnchor + 1\n          }\n        });\n        prevLhs = lhsAnchor + 1;\n        prevRhs = rhsAnchor + 1;\n      }\n      if (prevLhs < lhsTokens.length || prevRhs < rhsTokens.length) {\n        await diffCore(ctx, lhsTokens, prevLhs, lhsTokens.length, rhsTokens, prevRhs, rhsTokens.length, findBestHistogramAnchor);\n      }\n      return ctx.entries;\n    }\n    const findBestHistogramAnchor = function(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, ctx) {\n      const diffOptions = ctx.options;\n      const LENGTH_BIAS_FACTOR = diffOptions.lengthBiasFactor || 0.7;\n      const UNIQUE_BONUS = 1 / (diffOptions.uniqueMultiplier || 1 / 0.5);\n      1 / (diffOptions.containerStartMultiplier || 1 / 0.85);\n      1 / (diffOptions.containerEndMultiplier || 1 / 0.8);\n      1 / (diffOptions.lineStartMultiplier || 1 / 0.85);\n      1 / (diffOptions.lineEndMultiplier || 1 / 0.9);\n      1 / (diffOptions.sectionHeadingMultiplier || 1 / 0.75);\n      const useLengthBias = !!ctx.options.useLengthBias;\n      const maxGram = ctx.options.maxGram || 1;\n      const useMatchPrefix = ctx.options.ignoreWhitespace !== "normalize";\n      const onlyAtEdge = ctx.options.ignoreWhitespace === "onlyAtEdge";\n      const maxLen = useMatchPrefix ? Math.floor(maxGram * 1.5) : maxGram;\n      const delimiter = useMatchPrefix ? "" : "\\0";\n      const freq = {};\n      for (let n = 1; n <= maxLen; n++) {\n        for (let i = lhsLower; i <= lhsUpper - n; i++) {\n          let key = lhsTokens[i].text;\n          for (let k = 1; k < n; k++) {\n            key += delimiter + lhsTokens[i + k].text;\n          }\n          freq[key] = (freq[key] || 0) + 1;\n        }\n        for (let i = rhsLower; i <= rhsUpper - n; i++) {\n          let key = rhsTokens[i].text;\n          for (let k = 1; k < n; k++) {\n            key += delimiter + rhsTokens[i + k].text;\n          }\n          freq[key] = (freq[key] || 0) + 1;\n        }\n      }\n      let best = null;\n      for (let i = lhsLower; i < lhsUpper; i++) {\n        const ltext1 = lhsTokens[i].text;\n        for (let j = rhsLower; j < rhsUpper; j++) {\n          let li = i, ri = j;\n          let lhsLen = 0, rhsLen = 0;\n          let nGrams = 0;\n          while (li < lhsUpper && ri < rhsUpper && lhsLen < maxLen && rhsLen < maxLen && nGrams < maxGram) {\n            const ltext = lhsTokens[li].text;\n            const rtext = rhsTokens[ri].text;\n            if (ltext === rtext) {\n              li++;\n              ri++;\n              lhsLen++;\n              rhsLen++;\n              nGrams++;\n              continue;\n            }\n            if (useMatchPrefix && ltext.length !== rtext.length && ltext[0] === rtext[0]) {\n              const match = matchPrefixTokens(lhsTokens, li, lhsUpper, rhsTokens, ri, rhsUpper, onlyAtEdge);\n              if (match) {\n                const matchedGrams = Math.min(match[0], match[1]);\n                if (lhsLen + match[0] <= maxLen && rhsLen + match[1] <= maxLen && nGrams + matchedGrams <= maxGram) {\n                  li += match[0];\n                  ri += match[1];\n                  lhsLen += match[0];\n                  rhsLen += match[1];\n                  nGrams += matchedGrams;\n                  continue;\n                }\n              }\n            }\n            break;\n          }\n          if (lhsLen > 0 && rhsLen > 0) {\n            let frequency;\n            let len;\n            if (lhsLen === 1) {\n              frequency = freq[ltext1] || 1;\n              len = ltext1.length;\n            } else {\n              let key = lhsTokens[i].text;\n              len = key.length;\n              for (let k = 1; k < lhsLen; k++) {\n                const text = lhsTokens[i + k].text;\n                key += delimiter + text;\n                len += text.length;\n              }\n              frequency = freq[key] || 1;\n            }\n            let score = 0;\n            score = useLengthBias ? frequency / (1 + Math.log(len + 1) * LENGTH_BIAS_FACTOR) : frequency;\n            if (frequency === 1) {\n              score *= UNIQUE_BONUS;\n            }\n            let boundaryBonus = 1;\n            score *= boundaryBonus;\n            if (!best || score < best.score) {\n              best = {\n                lhsIndex: i,\n                lhsLength: lhsLen,\n                rhsIndex: j,\n                rhsLength: rhsLen,\n                score\n                // anchorText,\n              };\n            }\n          }\n        }\n      }\n      return best ?? null;\n    };\n    async function diffCore(ctx, leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, findAnchor, consumeDirections = 3) {\n      if (lhsLower > lhsUpper || rhsLower > rhsUpper) {\n        throw new Error("Invalid range");\n      }\n      const entries = ctx.entries;\n      const now = performance.now();\n      if (now - ctx.lastYield > 100) {\n        ctx.lastYield = now;\n        await new Promise((resolve) => setTimeout(resolve, 0));\n        if (ctx.cancel) throw new Error("cancelled");\n      }\n      let skippedHead;\n      let skippedTail;\n      [lhsLower, lhsUpper, rhsLower, rhsUpper, skippedHead, skippedTail] = consumeCommonEdges(\n        leftTokens,\n        rightTokens,\n        lhsLower,\n        lhsUpper,\n        rhsLower,\n        rhsUpper,\n        ctx.options.tokenization === "word" ? ctx.options.ignoreWhitespace : "normalize",\n        consumeDirections\n      );\n      for (const item of skippedHead) {\n        entries.push(item);\n      }\n      let anchor = null;\n      if (lhsLower < lhsUpper && rhsLower < rhsUpper && (anchor = findAnchor(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, ctx)) && (anchor.lhsLength > 0 || anchor.rhsLength > 0) && // for safety! 적어도 한쪽이라도 영역을 줄여야 무한루프 안 생길 듯?\n      anchor.lhsIndex >= lhsLower && anchor.lhsIndex + anchor.lhsLength <= lhsUpper && anchor.rhsIndex >= rhsLower && anchor.rhsIndex + anchor.rhsLength <= rhsUpper) {\n        await diffCore(ctx, leftTokens, lhsLower, anchor.lhsIndex, rightTokens, rhsLower, anchor.rhsIndex, findAnchor, 2);\n        await diffCore(ctx, leftTokens, anchor.lhsIndex, lhsUpper, rightTokens, anchor.rhsIndex, rhsUpper, findAnchor, 1);\n      } else {\n        if (lhsLower < lhsUpper || rhsLower < rhsUpper) {\n          let type = 0;\n          if (lhsLower < lhsUpper) type |= 1;\n          if (rhsLower < rhsUpper) type |= 2;\n          entries.push({\n            type,\n            left: {\n              start: lhsLower,\n              end: lhsUpper\n            },\n            right: {\n              start: rhsLower,\n              end: rhsUpper\n            }\n          });\n        }\n      }\n      for (const item of skippedTail) {\n        entries.push(item);\n      }\n      return entries;\n    }\n    function consumeCommonEdges(lhsTokens, rhsTokens, lhsLower, lhsUpper, rhsLower, rhsUpper, whitespace = "onlyAtEdge", consumeDirections = 3) {\n      const head = [];\n      const tail = [];\n      let matchedCount;\n      if (consumeDirections & 1) {\n        while (lhsLower < lhsUpper && rhsLower < rhsUpper) {\n          if (lhsTokens[lhsLower].text === rhsTokens[rhsLower].text) {\n            head.push({\n              type: 0,\n              left: { start: lhsLower, end: lhsLower + 1 },\n              right: { start: rhsLower, end: rhsLower + 1 }\n            });\n            lhsLower++;\n            rhsLower++;\n          } else if (whitespace !== "normalize" && lhsTokens[lhsLower].text.length !== rhsTokens[rhsLower].text.length && lhsTokens[lhsLower].text[0] === rhsTokens[rhsLower].text[0] && (matchedCount = matchPrefixTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, whitespace === "onlyAtEdge"))) {\n            head.push({\n              type: 0,\n              left: {\n                start: lhsLower,\n                end: lhsLower + matchedCount[0]\n              },\n              right: {\n                start: rhsLower,\n                end: rhsLower + matchedCount[1]\n              }\n            });\n            lhsLower += matchedCount[0];\n            rhsLower += matchedCount[1];\n          } else {\n            break;\n          }\n        }\n      }\n      if (consumeDirections & 2) {\n        while (lhsUpper > lhsLower && rhsUpper > rhsLower) {\n          if (lhsTokens[lhsUpper - 1].text === rhsTokens[rhsUpper - 1].text) {\n            tail.push({\n              type: 0,\n              left: { start: lhsUpper - 1, end: lhsUpper },\n              right: { start: rhsUpper - 1, end: rhsUpper }\n            });\n            lhsUpper--;\n            rhsUpper--;\n          } else if (whitespace !== "normalize" && lhsTokens[lhsUpper - 1].text.length !== rhsTokens[rhsUpper - 1].text.length && lhsTokens[lhsUpper - 1].text.at(-1) === rhsTokens[rhsUpper - 1].text.at(-1) && (matchedCount = matchSuffixTokens(lhsTokens, lhsLower, lhsUpper, rhsTokens, rhsLower, rhsUpper, whitespace === "onlyAtEdge"))) {\n            tail.push({\n              type: 0,\n              left: {\n                start: lhsUpper - matchedCount[0],\n                end: lhsUpper\n              },\n              right: {\n                start: rhsUpper - matchedCount[1],\n                end: rhsUpper\n              }\n            });\n            lhsUpper -= matchedCount[0];\n            rhsUpper -= matchedCount[1];\n          } else {\n            break;\n          }\n        }\n        tail.reverse();\n      }\n      return [lhsLower, lhsUpper, rhsLower, rhsUpper, head, tail];\n    }\n    function matchPrefixTokens(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, allowJoinOnlyAtLineBoundary) {\n      if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;\n      let i = lhsLower, j = rhsLower;\n      let ci = 0, cj = 0;\n      let lhsToken = leftTokens[i++], ltext = lhsToken.text, lhsLen = ltext.length;\n      let rhsToken = rightTokens[j++], rtext = rhsToken.text, rhsLen = rtext.length;\n      while (true) {\n        while (ci < lhsLen && cj < rhsLen) {\n          if (ltext[ci++] !== rtext[cj++]) {\n            return false;\n          }\n        }\n        if (ci === lhsLen && cj === rhsLen) return [i - lhsLower, j - rhsLower];\n        if (ci === lhsLen) {\n          if (i === lhsUpper) return false;\n          if (lhsToken.flags & TokenFlags.NO_JOIN_NEXT || allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_END)) {\n            return false;\n          }\n          lhsToken = leftTokens[i++];\n          if (!lhsToken) return false;\n          if (lhsToken.flags & TokenFlags.NO_JOIN_PREV || allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_START)) {\n            return false;\n          }\n          ltext = lhsToken.text;\n          lhsLen = ltext.length;\n          ci = 0;\n        }\n        if (cj === rhsLen) {\n          if (j === rhsUpper) return false;\n          if (rhsToken.flags & TokenFlags.NO_JOIN_NEXT || allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_END)) {\n            return false;\n          }\n          rhsToken = rightTokens[j++];\n          if (!rhsToken) return false;\n          if (rhsToken.flags & TokenFlags.NO_JOIN_PREV || allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_START)) {\n            return false;\n          }\n          rtext = rhsToken.text;\n          rhsLen = rtext.length;\n          cj = 0;\n        }\n      }\n    }\n    function matchSuffixTokens(leftTokens, lhsLower, lhsUpper, rightTokens, rhsLower, rhsUpper, allowJoinOnlyAtLineBoundary) {\n      if (lhsLower >= lhsUpper || rhsLower >= rhsUpper) return false;\n      let i = lhsUpper - 1, j = rhsUpper - 1;\n      let lhsToken = leftTokens[i--], ltext = lhsToken.text, rhsToken = rightTokens[j--], rtext = rhsToken.text;\n      let ci = ltext.length - 1, cj = rtext.length - 1;\n      while (true) {\n        while (ci >= 0 && cj >= 0) {\n          if (ltext[ci--] !== rtext[cj--]) {\n            return false;\n          }\n        }\n        if (ci < 0 && cj < 0) return [lhsUpper - i - 1, rhsUpper - j - 1];\n        if (ci < 0) {\n          if (i < lhsLower) return false;\n          if (lhsToken.flags & TokenFlags.NO_JOIN_PREV || allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_START)) {\n            return false;\n          }\n          lhsToken = leftTokens[i--];\n          if (!lhsToken) return false;\n          if (lhsToken.flags & TokenFlags.NO_JOIN_NEXT || allowJoinOnlyAtLineBoundary && !(lhsToken.flags & TokenFlags.LINE_END)) {\n            return false;\n          }\n          ltext = lhsToken.text;\n          ci = lhsToken.text.length - 1;\n        }\n        if (cj < 0) {\n          if (j < rhsLower) return false;\n          if (rhsToken.flags & TokenFlags.NO_JOIN_PREV || allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_START)) {\n            return false;\n          }\n          rhsToken = rightTokens[j--];\n          if (!rhsToken) return false;\n          if (rhsToken.flags & TokenFlags.NO_JOIN_NEXT || allowJoinOnlyAtLineBoundary && !(rhsToken.flags & TokenFlags.LINE_END)) {\n            return false;\n          }\n          rtext = rhsToken.text;\n          cj = rhsToken.text.length - 1;\n        }\n      }\n    }\n\n})();\n';
  const blob = typeof self !== "undefined" && self.Blob && new Blob([jsContent], { type: "text/javascript;charset=utf-8" });
  function WorkerWrapper(options) {
    let objURL;
    try {
      objURL = blob && (self.URL || self.webkitURL).createObjectURL(blob);
      if (!objURL) throw "";
      const worker = new Worker(objURL, {
        name: options?.name
      });
      worker.addEventListener("error", () => {
        (self.URL || self.webkitURL).revokeObjectURL(objURL);
      });
      return worker;
    } catch (e) {
      return new Worker(
        "data:text/javascript;charset=utf-8," + encodeURIComponent(jsContent),
        {
          name: options?.name
        }
      );
    } finally {
      objURL && (self.URL || self.webkitURL).revokeObjectURL(objURL);
    }
  }

  let worker = null;
  function initializeDiffWorker(onComplete) {
    if (!worker) {
      worker = new WorkerWrapper();
    }
    let currentReqId = 0;
    worker.onmessage = (e) => {
      const data = e.data;
      if (data.type === "diff") {
        if (data.reqId !== currentReqId) {
          return;
        }
        const result = {
          diffs: data.diffs,
          options: data.options,
          processTime: data.processTime
        };
        onComplete(result);
      } else if (data.type === "error") {
        console.error(`Error in diff worker (reqId: ${data.reqId}):`, data.error);
      }
    };
    return {
      run: (leftTokens, rightTokens, options) => {
        const request = {
          type: "diff",
          reqId: ++currentReqId,
          leftTokens,
          rightTokens,
          options
        };
        worker.postMessage(request);
      },
      terminate: () => {
        if (worker) {
          worker.terminate();
          worker = null;
        }
      }
    };
  }

  function createEvent() {
    let handlers = [];
    const on = (cb) => {
      handlers.push(cb);
      return () => {
        handlers = handlers.filter((h) => h !== cb);
      };
    };
    const emit = (arg) => {
      for (const cb of handlers) {
        try {
          cb(arg);
        } catch (e) {
          console.error("event error", e);
        }
      }
    };
    return { on, emit };
  }

  const diffOptions$1 = {
    algorithm: "histogram",
    tokenization: "word",
    ignoreWhitespace: "ignore",
    greedyMatch: false,
    useLengthBias: true,
    maxGram: 4,
    lengthBiasFactor: 0.7,
    containerStartMultiplier: 1 / 0.85,
    containerEndMultiplier: 1 / 0.9,
    sectionHeadingMultiplier: 1 / 0.75,
    lineStartMultiplier: 1 / 0.9,
    lineEndMultiplier: 1 / 0.95,
    uniqueMultiplier: 1 / 0.6667
  };
  const SCROLL_TIMEOUT = 100;
  class DiffController {
    #diffWorker;
    #leftEditor;
    #rightEditor;
    #renderer;
    #editorPairer;
    // #editorPairer: EditorPairer;
    #postProcessor = null;
    diffContext = null;
    #syncMode = false;
    // Event emitters
    #syncModeChangeEvent = createEvent();
    #hoveredDiffIndexChangeEvent = createEvent();
    #diffVisibilityChangeEvent = createEvent();
    #diffInitEvent = createEvent();
    #diffStartEvent = createEvent();
    #diffDoneEvent = createEvent();
    #textSelectionEvent = createEvent();
    #editorContentsChanged = {
      left: false,
      right: false
    };
    #scrollingEditor = null;
    #lastScrolledEditor = null;
    #focusedEditor = null;
    #lastFocusedEditor = null;
    #scrollTimeoutId = null;
    #preventScrollEvent = false;
    #visibleDiffs = {
      left: /* @__PURE__ */ new Set(),
      right: /* @__PURE__ */ new Set()
    };
    constructor(leftEditor, rightEditor, renderer) {
      this.#leftEditor = leftEditor;
      this.#rightEditor = rightEditor;
      this.#renderer = renderer;
      this.#editorPairer = new EditorPairer(leftEditor, rightEditor);
      this.#setupEventListeners();
      this.#diffWorker = initializeDiffWorker(this.#onDiffCompleted.bind(this));
      this.#diffWorker.run([], [], diffOptions$1);
      renderer.guideLineEnabled = this.#syncMode;
      const editorCallbacks = {
        contentChanged: this.#handleEditorContentChanged.bind(this),
        contentChanging: this.#handleEditorContentChanging.bind(this),
        scroll: this.#handleEditorScroll.bind(this),
        scrollEnd: this.#handleEditorScrollEnd.bind(this),
        resize: this.#handleEditorResize.bind(this),
        focus: this.#handleEditorFocus.bind(this),
        blur: this.#handleEditorBlur.bind(this),
        click: this.#handleEditorClick.bind(this),
        copy: this.#handleEditorCopy.bind(this),
        mouseMove: this.#handleEditorMouseMove.bind(this),
        mouseLeave: this.#handleEditorMouseLeave.bind(this)
      };
      leftEditor.setCallbacks(editorCallbacks);
      rightEditor.setCallbacks(editorCallbacks);
      renderer.onPrepare(this.#handleRendererPrepare.bind(this));
      renderer.onDraw(this.#handleRendererDraw.bind(this));
      renderer.onDiffVisibilityChanged(this.#handleRendererDiffVisibilityChanged.bind(this));
      renderer.onHoveredDiffIndexChanged(this.#handleHoveredDiffIndexChanged.bind(this));
    }
    get leftEditor() {
      return this.#leftEditor;
    }
    get rightEditor() {
      return this.#rightEditor;
    }
    get renderer() {
      return this.#renderer;
    }
    get syncMode() {
      return this.#syncMode;
    }
    set syncMode(value) {
      value = !!value;
      if (this.#syncMode === value) return;
      this.#syncMode = value;
      this.#renderer.guideLineEnabled = value;
      if (value) {
        document.body.classList.add("sync-mode");
        this.alignEditors();
      } else {
        document.body.classList.remove("sync-mode");
        this.#renderer.invalidateAll();
      }
      this.#syncModeChangeEvent.emit(value);
    }
    #setupEventListeners() {
      document.addEventListener("selectionchange", this.#handleSelectionChange.bind(this));
    }
    alignEditors(reset = false) {
      this.#preventScrollEvent = true;
      this.#editorPairer.alignAnchorsGently(() => {
        this.#leftEditor.forceReflow();
        this.#rightEditor.forceReflow();
        this.#renderer.invalidateGeometries();
        const primaryEditor = this.#lastScrolledEditor ?? this.#lastFocusedEditor ?? this.#rightEditor;
        this.#preventScrollEvent = false;
        if (this.#scrollingEditor) {
          this.#handleEditorScrollEnd(this.#scrollingEditor);
        }
        this.#handleEditorScroll(primaryEditor, true);
        requestAnimationFrame(() => {
        });
      }, reset);
    }
    #handleSelectionChange() {
      if (!this.diffContext) {
        return;
      }
      const selection = this.resolveSelectionSpanPair();
      let sourceRange = null;
      let targetRange = null;
      let leftSpan = void 0;
      let rightSpan = void 0;
      let selectedSpan = void 0;
      let sourceEditor = null;
      let targetEditor = null;
      if (selection) {
        ({ left: leftSpan, right: rightSpan, sourceRange } = selection);
        if (leftSpan && leftSpan.end >= leftSpan.start && rightSpan && rightSpan.end >= rightSpan.start) {
          let otherStartTokenIndex;
          let otherEndTokenIndex;
          if (selection.source === "left") {
            selectedSpan = leftSpan;
            targetEditor = this.#rightEditor;
            otherStartTokenIndex = rightSpan.start;
            otherEndTokenIndex = rightSpan.end;
            sourceEditor = this.#leftEditor;
            targetEditor = this.#rightEditor;
          } else {
            selectedSpan = rightSpan;
            targetEditor = this.#leftEditor;
            otherStartTokenIndex = leftSpan.start;
            otherEndTokenIndex = leftSpan.end;
            sourceEditor = this.#rightEditor;
            targetEditor = this.#leftEditor;
          }
          sourceRange = sourceEditor.getTokenRange(selectedSpan.start, selectedSpan.end);
          targetRange = targetEditor.getTokenRange(otherStartTokenIndex, otherEndTokenIndex);
        }
      }
      this.#renderer.setSelectionHighlight(targetEditor === this.#leftEditor ? "left" : "right", targetRange);
      this.#textSelectionEvent.emit({
        sourceEditor: selection ? selection.source : "left",
        leftTokenSpan: leftSpan || { start: 0, end: 0 },
        rightTokenSpan: rightSpan || { start: 0, end: 0 },
        leftTokenRange: sourceRange || new Range(),
        rightTokenRange: targetRange || new Range()
      });
    }
    #onDiffCompleted(result) {
      if (this.#postProcessor) {
        this.#postProcessor.cancel();
      }
      this.#postProcessor = new DiffPostProcessor(this.#leftEditor, this.#rightEditor, this.#editorPairer, result.diffs, result.options);
      this.#postProcessor.process(this.#handleDiffContextReady);
    }
    #handleEditorContentChanging(editor) {
    }
    #handleEditorContentChanged(editor) {
      console.log("Editor content changed", editor);
      let leftTokens = null;
      let rightTokens = null;
      {
        leftTokens = buildTokenArray(this.#leftEditor.tokens);
      }
      {
        rightTokens = buildTokenArray(this.#rightEditor.tokens);
      }
      this.#diffWorker.run(leftTokens, rightTokens, diffOptions$1);
      this.#diffStartEvent.emit({
        leftTokenCount: this.#leftEditor.tokens.length,
        rightTokenCount: this.#rightEditor.tokens.length
      });
      this.#editorContentsChanged.left = false;
      this.#editorContentsChanged.right = false;
    }
    #handleEditorScroll(editor, skipEndCheck = false) {
      if (this.#preventScrollEvent) {
        return;
      }
      this.#renderer.invalidateScroll(editor.name);
      if (!this.#scrollingEditor) {
        this.#lastScrolledEditor = this.#scrollingEditor = editor;
      }
      if (this.#scrollingEditor === editor) {
        if (this.#scrollTimeoutId) {
          clearTimeout(this.#scrollTimeoutId);
          this.#scrollTimeoutId = null;
        }
        if (!skipEndCheck) {
          this.#scrollTimeoutId = setTimeout(() => this.#handleEditorScrollEnd(editor), SCROLL_TIMEOUT);
        }
        if (this.#syncMode) ;
      }
    }
    #handleEditorScrollEnd(editor) {
      if (this.#scrollingEditor !== editor) {
        return;
      }
      if (this.#scrollTimeoutId) {
        clearTimeout(this.#scrollTimeoutId);
        this.#scrollTimeoutId = null;
      }
      this.#scrollingEditor = null;
    }
    #handleEditorResize(_editor) {
    }
    #handleEditorFocus(_editor) {
      this.#lastFocusedEditor = this.#focusedEditor = _editor;
    }
    #handleEditorBlur(_editor) {
      this.#focusedEditor = null;
    }
    #handleEditorClick(_editor, _e) {
      this.#lastFocusedEditor = this.#focusedEditor = _editor;
    }
    #handleEditorCopy(_editor, _e) {
    }
    #handleEditorMouseMove(_editor, e) {
      this.#renderer.updateMousePosition(e.clientX, e.clientY);
    }
    #handleEditorMouseLeave(_editor, _e) {
    }
    #handleRendererPrepare(_time) {
    }
    #handleRendererDraw(_time) {
    }
    #handleRendererDiffVisibilityChanged(changes) {
      for (const region of ["left", "right"]) {
        for (const entry of changes[region]) {
          const diffIndex = entry.item;
          if (entry.isVisible) {
            this.#visibleDiffs[region].add(diffIndex);
          } else {
            this.#visibleDiffs[region].delete(diffIndex);
          }
        }
      }
      this.#diffVisibilityChangeEvent.emit(changes);
    }
    #handleHoveredDiffIndexChanged(diffIndex) {
      this.#hoveredDiffIndexChangeEvent.emit(diffIndex);
    }
    #handleDiffContextReady = (diffContext) => {
      this.diffContext = diffContext;
      this.#renderer.setDiffs(diffContext.diffs);
      this.#diffDoneEvent.emit(diffContext);
    };
    onSyncModeChange(callback) {
      return this.#syncModeChangeEvent.on(callback);
    }
    onHoveredDiffIndexChange(callback) {
      return this.#hoveredDiffIndexChangeEvent.on(callback);
    }
    onDiffVisibilityChanged(callback) {
      return this.#diffVisibilityChangeEvent.on(callback);
    }
    onDiffInit(callback) {
      return this.#diffInitEvent.on(callback);
    }
    onDiffStart(callback) {
      return this.#diffStartEvent.on(callback);
    }
    onDiffDone(callback) {
      return this.#diffDoneEvent.on(callback);
    }
    onTextSelection(callback) {
      return this.#textSelectionEvent.on(callback);
    }
    // 그닥 안전하지는 않지만 그렇게 중요한 함수도 아니다.
    getVisibleDiffs() {
      return {
        left: this.#visibleDiffs.left,
        right: this.#visibleDiffs.right
      };
    }
    getEditorSelectionRange() {
      const selection = window.getSelection();
      let editor = null;
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (this.#leftEditor.contains(range)) {
          editor = this.#leftEditor;
        } else if (this.#rightEditor.contains(range)) {
          editor = this.#rightEditor;
        }
        if (editor) {
          return { editor: editor.name, range };
        }
      }
      return null;
    }
    resolveSelectionSpanPair() {
      if (!this.diffContext) {
        return null;
      }
      const selection = this.getEditorSelectionRange();
      if (selection) {
        const editor = selection.editor === "left" ? this.#leftEditor : this.#rightEditor;
        let sourceSpan = editor.findTokenOverlapIndices(selection.range);
        if (sourceSpan) {
          if (sourceSpan.end === sourceSpan.start) {
            sourceSpan.end += 1;
          }
          const matchingPair = this.diffContext.resolveMatchingSpanPair(editor.name, sourceSpan);
          if (matchingPair) {
            return {
              left: matchingPair.left,
              right: matchingPair.right,
              source: editor.name,
              sourceRange: selection.range
            };
          }
        }
      }
      return null;
    }
    scrollToDiff(diffIndex, { primary, toEnd = false } = {}) {
      const leftRect = this.#renderer.getDiffRect("left", diffIndex);
      const rightRect = this.#renderer.getDiffRect("right", diffIndex);
      if (!leftRect || !rightRect) {
        return;
      }
      if (this.#syncMode) {
        const primaryEditor = primary === "left" ? this.#leftEditor : this.#rightEditor;
        const rect = primary === "left" ? leftRect : rightRect;
        let scrollTop;
        if (toEnd) {
          scrollTop = rect.y + rect.height - EDITOR_SCROLL_MARGIN;
        } else {
          scrollTop = rect.y - EDITOR_SCROLL_MARGIN;
        }
        primaryEditor.scrollTo(scrollTop, { behavior: "smooth" });
      } else {
        const leftScrollTop = Math.min(leftRect.y - EDITOR_SCROLL_MARGIN);
        const rightScrollTop = Math.min(rightRect.y - EDITOR_SCROLL_MARGIN);
        this.#leftEditor.scrollTo(leftScrollTop, { behavior: "smooth" });
        this.#rightEditor.scrollTo(rightScrollTop, { behavior: "smooth" });
      }
    }
  }
  function buildTokenArray(richTokens) {
    const result = new Array(richTokens.length);
    for (let i = 0; i < richTokens.length; i++) {
      const richToken = richTokens[i];
      result[i] = {
        text: richToken.text,
        flags: richToken.flags
      };
    }
    return result;
  }

  var wrapper$2 = 'Editor_wrapper__11exldh0';
  var editor = 'Editor_editor__11exldh1';
  var heightBoost = 'Editor_heightBoost__11exldh2';

  const COMMON_ALLOWED_STYLES = {
    textAlign: true,
    fontSize: true,
    fontWeight: true,
    fontStyle: true
  };
  const DefaultElementOptions = {
    allowedStyles: COMMON_ALLOWED_STYLES
  };
  const AsDivElementOptions = {
    replaceTag: "DIV"
  };
  const SMART_TAG_OPTIONS = {
    unwrap: true
  };
  const EXCLUDED_TAG_OPTIONS = {
    exclude: true
  };
  const COMMON_INLINE_ELEMENT_OPTIONS = {
    allowedStyles: COMMON_ALLOWED_STYLES,
    replaceTag: "SPAN"
  };
  const ELEMENT_POLICIES = {
    SCRIPT: EXCLUDED_TAG_OPTIONS,
    STYLE: EXCLUDED_TAG_OPTIONS,
    IFRAME: EXCLUDED_TAG_OPTIONS,
    OBJECT: EXCLUDED_TAG_OPTIONS,
    EMBED: EXCLUDED_TAG_OPTIONS,
    LINK: EXCLUDED_TAG_OPTIONS,
    META: EXCLUDED_TAG_OPTIONS,
    BASE: EXCLUDED_TAG_OPTIONS,
    APPLET: EXCLUDED_TAG_OPTIONS,
    FRAME: EXCLUDED_TAG_OPTIONS,
    FRAMESET: EXCLUDED_TAG_OPTIONS,
    NOSCRIPT: EXCLUDED_TAG_OPTIONS,
    SVG: EXCLUDED_TAG_OPTIONS,
    MATH: EXCLUDED_TAG_OPTIONS,
    TEMPLATE: EXCLUDED_TAG_OPTIONS,
    HEAD: EXCLUDED_TAG_OPTIONS,
    TITLE: EXCLUDED_TAG_OPTIONS,
    CANVAS: EXCLUDED_TAG_OPTIONS,
    AUDIO: EXCLUDED_TAG_OPTIONS,
    VIDEO: EXCLUDED_TAG_OPTIONS,
    TRACK: EXCLUDED_TAG_OPTIONS,
    SOURCE: EXCLUDED_TAG_OPTIONS,
    BGSOUND: EXCLUDED_TAG_OPTIONS,
    TABLE: DefaultElementOptions,
    TBODY: { unwrap: true },
    THEAD: { unwrap: true },
    TFOOT: { unwrap: true },
    CAPTION: DefaultElementOptions,
    TR: DefaultElementOptions,
    TD: { allowedAttrs: { colspan: true, rowspan: true, width: true }, allowedStyles: { ...COMMON_ALLOWED_STYLES, width: true } },
    TH: { replaceTag: "TD", allowedAttrs: { colspan: true, rowspan: true }, allowedStyles: COMMON_ALLOWED_STYLES },
    H1: DefaultElementOptions,
    H2: DefaultElementOptions,
    H3: DefaultElementOptions,
    H4: DefaultElementOptions,
    H5: DefaultElementOptions,
    H6: DefaultElementOptions,
    SUP: DefaultElementOptions,
    SUB: DefaultElementOptions,
    EM: DefaultElementOptions,
    I: DefaultElementOptions,
    S: DefaultElementOptions,
    B: DefaultElementOptions,
    STRONG: DefaultElementOptions,
    U: DefaultElementOptions,
    STRIKE: DefaultElementOptions,
    P: DefaultElementOptions,
    UL: DefaultElementOptions,
    OL: DefaultElementOptions,
    LI: DefaultElementOptions,
    DL: DefaultElementOptions,
    DT: DefaultElementOptions,
    DD: DefaultElementOptions,
    DIV: DefaultElementOptions,
    BLOCKQUOTE: DefaultElementOptions,
    ADDRESS: DefaultElementOptions,
    FIELDSET: DefaultElementOptions,
    LEGEND: DefaultElementOptions,
    CODE: DefaultElementOptions,
    PRE: DefaultElementOptions,
    SMALL: DefaultElementOptions,
    DEL: DefaultElementOptions,
    INS: DefaultElementOptions,
    IMG: { void: true, allowedAttrs: { src: true, width: true, height: true }, allowedStyles: { width: true, height: true } },
    FONT: { replaceTag: "SPAN", allowedStyles: COMMON_ALLOWED_STYLES },
    SPAN: DefaultElementOptions,
    LABEL: DefaultElementOptions,
    BR: { void: true },
    HR: { void: true },
    FORM: AsDivElementOptions,
    NAV: AsDivElementOptions,
    MAIN: AsDivElementOptions,
    HEADER: AsDivElementOptions,
    FOOTER: AsDivElementOptions,
    SECTION: AsDivElementOptions,
    ARTICLE: AsDivElementOptions,
    ASIDE: AsDivElementOptions,
    A: {
      replaceTag: "SPAN",
      allowedStyles: COMMON_ALLOWED_STYLES
    },
    MARK: {
      replaceTag: "SPAN",
      allowedStyles: COMMON_ALLOWED_STYLES
    },
    "#document-fragment": DefaultElementOptions,
    FIGURE: DefaultElementOptions,
    FIGCAPTION: DefaultElementOptions
  };
  const WINGDINGS_TRANSFORM = {
    Wingdings: {
      "ß": "🡠",
      "à": "🡢",
      "á": "🡡",
      "â": "🡣",
      "ã": "🡤",
      "ä": "🡥",
      "å": "🡧",
      "æ": "🡦",
      "ç": "🡠",
      "è": "🡢",
      "é": "🡡",
      "ê": "🡣",
      "ë": "🡤",
      "ì": "🡥",
      "í": "🡧",
      "î": "🡦",
      "": "⓪",
      "": "①",
      "": "②",
      "": "③",
      "": "④",
      "": "⑤",
      "": "⑥",
      "": "⑦",
      "": "⑧",
      "": "⑨",
      "": "⑩",
      "": "⓿",
      "": "❶",
      "": "❷",
      "": "❸",
      "": "❹",
      "": "❺",
      "": "❻",
      "": "❼",
      "": "❽",
      "": "❾",
      "": "❿"
    }
  };
  function transformText(input, charMap) {
    let result = "";
    for (const ch of input) {
      result += charMap[ch] || ch;
    }
    return result;
  }
  function sanitizeHTML(rawHTML) {
    const EMPTY_LINE = document.createElement("P");
    EMPTY_LINE.appendChild(document.createElement("BR"));
    const START_TAG = "<!--StartFragment-->";
    const END_TAG = "<!--EndFragment-->";
    const startIndex = rawHTML.indexOf(START_TAG);
    if (startIndex >= 0) {
      const endIndex = rawHTML.lastIndexOf(END_TAG);
      if (endIndex >= 0) {
        rawHTML = rawHTML.slice(startIndex + START_TAG.length, endIndex);
      } else {
        rawHTML = rawHTML.slice(startIndex + START_TAG.length);
      }
    }
    const tmpl = document.createElement("template");
    tmpl.innerHTML = rawHTML;
    const statesStack = [];
    let states = {
      font: null
    };
    function traverse(node) {
      if (node.nodeType !== 1 && // element
      node.nodeType !== 11) {
        return null;
      }
      if (node.nodeName === "DIV") {
        if (node.className === "aspNetHidden") {
          return null;
        }
        if (node.className === "pak_aside clear") {
          return null;
        }
        if (node.className === "pak_tab_menu") {
          return null;
        }
        if (node.className === "listBtn") {
          return null;
        }
        if (node.id === "ManualWrap") ;
        if (node.className === "ManualEvalWrap") {
          return null;
        }
      } else if (node.nodeName === "P") {
        if (node.className === "pak_search") {
          return null;
        }
      }
      const nodeName = node.nodeName;
      let elementOptions = ELEMENT_POLICIES[nodeName];
      if (!elementOptions) {
        if (nodeName === "O:P" && (node.childNodes.length === 0 || node.childNodes.length === 1 && node.firstChild.nodeType === 3 && node.firstChild.nodeValue === " ")) {
          elementOptions = ELEMENT_POLICIES["BR"];
        } else if (nodeName.startsWith("ST1:")) {
          elementOptions = SMART_TAG_OPTIONS;
        }
        if (!elementOptions) {
          elementOptions = COMMON_INLINE_ELEMENT_OPTIONS;
        }
      }
      if (elementOptions.exclude) {
        return null;
      }
      let containerNode;
      if (elementOptions.unwrap || node.nodeType === 11) {
        containerNode = document.createDocumentFragment();
      } else {
        containerNode = document.createElement(elementOptions.replaceTag || nodeName);
        if (elementOptions.allowedAttrs) {
          for (const attr of node.attributes) {
            if (elementOptions.allowedAttrs[attr.name]) {
              containerNode.setAttribute(attr.name, attr.value);
            }
          }
        }
        if (elementOptions.allowedStyles) {
          const style = node.style;
          for (const prop in elementOptions.allowedStyles) {
            if (style[prop]) {
              containerNode.style[prop] = style[prop];
            }
          }
        }
      }
      if (elementOptions.void) {
        return {
          node: containerNode,
          hasText: false,
          hasNonEmptyText: false,
          caretReachable: false
        };
      }
      statesStack.push(states);
      states = { ...states };
      const result2 = {
        node: containerNode,
        hasText: false,
        hasNonEmptyText: false,
        caretReachable: false
      };
      if (containerNode.nodeType === 1) {
        let color = null;
        if (node.classList.contains("color-red")) {
          color = "red";
        } else {
          let colorValue = node.style?.color;
          if (colorValue) {
            if (colorValue === "inherit") ; else {
              if (isReddish(colorValue)) {
                color = "red";
              }
            }
          }
        }
        if (color) {
          containerNode.classList.add(`color-${color}`);
        }
        let fontFamily = node.style?.fontFamily;
        if (fontFamily && fontFamily !== "inherit") {
          states.font = fontFamily;
        }
      }
      const children = [];
      let isTextless = TEXTLESS_ELEMENTS[nodeName];
      for (const childNode of node.childNodes) {
        let childResult = null;
        if (childNode.nodeType === 3) {
          if (!isTextless) {
            let text = childNode.nodeValue;
            if (states.font && WINGDINGS_TRANSFORM[states.font]) {
              text = transformText(text, WINGDINGS_TRANSFORM[states.font]);
            }
            childResult = {
              node: document.createTextNode(text),
              hasText: false,
              hasNonEmptyText: false,
              caretReachable: false
            };
          }
        } else {
          childResult = traverse(childNode);
        }
        if (childResult !== null) {
          children.push(childResult);
        }
      }
      states = statesStack.pop();
      let prevCaretReachable = false;
      for (let i = 0; i < children.length; i++) {
        const childResult = children[i];
        if (node === tmpl.content || nodeName === "TD") ;
        if (childResult.node.nodeType === 3) {
          result2.hasText = true;
          result2.hasNonEmptyText ||= childResult.node.nodeValue.trim().length > 0;
          if (!result2.caretReachable) {
            result2.caretReachable = childResult.node.nodeValue.length > 0;
          }
        } else {
          result2.hasText ||= childResult.hasText;
          result2.hasNonEmptyText ||= childResult.hasNonEmptyText;
          result2.caretReachable ||= childResult.caretReachable || childResult.node.nodeName === "BR";
        }
        if (node === tmpl.content || nodeName === "TD") {
          if (childResult.node.nodeName === "TABLE") {
            if (!prevCaretReachable) {
              containerNode.appendChild(EMPTY_LINE.cloneNode(true));
            }
            prevCaretReachable = false;
          }
        }
        containerNode.appendChild(childResult.node);
        if (childResult.node.nodeName === "TABLE") {
          prevCaretReachable = false;
        } else {
          prevCaretReachable ||= childResult.caretReachable;
        }
      }
      if (!prevCaretReachable && (node === tmpl.content || nodeName === "TD")) {
        containerNode.appendChild(EMPTY_LINE.cloneNode(true));
      }
      if (containerNode.nodeName === "TABLE") {
        result2.caretReachable = false;
        result2.hasText = false;
        result2.hasNonEmptyText = false;
      }
      return result2;
    }
    const result = traverse(tmpl.content);
    return result.node;
  }
  const isReddish = /* @__PURE__ */ (() => {
    let ctx = null;
    const reddishCache = /* @__PURE__ */ new Map([
      ["red", true],
      ["#ff0000", true],
      ["#e60000", true],
      ["#c00000", true],
      ["rgb(255,0,0)", true],
      ["rgb(230,0,0)", true],
      ["#000000", false],
      ["#333333", false],
      ["#ffffff", false],
      ["black", false],
      ["blue", false],
      ["white", false],
      ["window", false],
      ["windowtext", false]
    ]);
    function getRGB(color) {
      const hex6 = /^#([0-9a-f]{6})$/i.exec(color);
      if (hex6) {
        const n = parseInt(hex6[1], 16);
        return [n >> 16 & 255, n >> 8 & 255, n & 255];
      }
      const hex3 = /^#([0-9a-f]{3})$/i.exec(color);
      if (hex3) {
        const [r, g, b] = hex3[1].split("").map((c) => parseInt(c + c, 16));
        return [r, g, b];
      }
      const rgb = /^rgba?\(([^)]+)\)$/i.exec(color);
      if (rgb) {
        const parts = rgb[1].split(",").map((s) => parseInt(s.trim(), 10));
        if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
      }
      if (!ctx) {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        ctx = canvas.getContext("2d");
      }
      try {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return [r, g, b];
      } catch {
        return null;
      }
    }
    return (color) => {
      let isRed = reddishCache.get(color);
      if (isRed !== void 0) return isRed;
      const rgb = getRGB(color);
      isRed = rgb ? rgb[0] >= 139 && rgb[0] - Math.max(rgb[1], rgb[2]) >= 65 : false;
      reddishCache.set(color, isRed);
      return isRed;
    };
  })();

  function createParagraphsFromText(plaintext, trimLines = false) {
    const lines = plaintext.split(/\r?\n/);
    const fragment = document.createDocumentFragment();
    for (const line of lines) {
      const p = document.createElement("P");
      const trimmedLine = trimLines ? line.trim() : line;
      if (trimmedLine === "") {
        p.appendChild(document.createElement("BR"));
      } else {
        p.textContent = trimmedLine;
      }
      fragment.appendChild(p);
    }
    return fragment;
  }

  function advanceNode(currentNode, rootNode = null, skipChildren = false) {
    if (!skipChildren && currentNode.firstChild) {
      return currentNode.firstChild;
    }
    let node = currentNode;
    while (node && node !== rootNode) {
      if (node.nextSibling) {
        return node.nextSibling;
      }
      node = node.parentNode;
    }
    return null;
  }

  function findAdjacentTextNode(node, skipEmpty = false) {
    let root = node;
    while (root && !BLOCK_ELEMENTS[root.nodeName]) {
      root = root.parentNode;
    }
    let next = advanceNode(node, root, true);
    while (next) {
      if (next.nodeType === 3) {
        if (!skipEmpty || next.nodeValue.length > 0) {
          return next;
        }
      } else {
        const nextName = next.nodeName;
        if (BLOCK_ELEMENTS[nextName]) {
          break;
        }
        if (nextName === "BR" || nextName === "IMG" || nextName === "HR") {
          break;
        }
      }
      next = advanceNode(next, root);
    }
    return null;
  }

  function mountHelper(wrapper, options) {
    let mountTarget = null;
    function mount(target) {
      if (mountTarget) {
        throw new Error(`Already mounted to ${mountTarget}. Unmount it first!`);
      }
      target.appendChild(wrapper);
      mountTarget = target;
      options?.onMount?.(target);
    }
    function unmount() {
      if (!mountTarget) {
        throw new Error(`Not mounted to any target.`);
      }
      if (wrapper.parentNode !== mountTarget) {
        throw new Error(`Mount mismatch. Expected: ${mountTarget}, Actual: ${wrapper.parentNode}`);
      }
      mountTarget.removeChild(wrapper);
      options?.onUnmount?.(mountTarget);
      mountTarget = null;
    }
    function getMountTarget() {
      return mountTarget;
    }
    return { mount, unmount, getMountTarget };
  }

  const INITIAL_EDITOR_HTML = document.createElement("P");
  INITIAL_EDITOR_HTML.appendChild(document.createElement("BR"));
  class Editor {
    #wrapper;
    #editorName;
    #editor = document.createElement("div");
    #heightBoost = document.createElement("div");
    // #wrapper: HTMLElement; // = document.createElement("div");
    #mutationObserver;
    #tokens = [];
    #tokenizeContext = null;
    #callbacks = {};
    #readonly = false;
    #mountHelper;
    constructor(editorName) {
      this.#editorName = editorName;
      this.#editor.contentEditable = "true";
      this.#editor.spellcheck = false;
      this.#editor.id = `diffseek-editor-${editorName}`;
      this.#editor.classList.add(editor, "diffseek-editor", `diffseek-editor-${editorName}`);
      this.#heightBoost.classList.add(heightBoost, "diffseek-editor-heightBoost", `diffseek-editor-heightBoost-${editorName}`);
      this.#mutationObserver = new MutationObserver((mutations) => this.#onMutation(mutations));
      this.observeMutation();
      this.#editor.addEventListener("copy", (e) => this.#onCopy(e));
      this.#editor.addEventListener("paste", (e) => this.#onPaste(e));
      this.#editor.addEventListener("input", () => this.#onInput());
      this.#editor.addEventListener("click", (e) => {
        this.#callbacks.click?.(this, e);
      });
      this.#editor.addEventListener("keydown", (e) => this.#onKeyDown(e));
      this.#editor.addEventListener("focus", () => {
        this.#callbacks.focus?.(this);
      });
      this.#editor.addEventListener("blur", () => {
        this.#callbacks.blur?.(this);
      });
      this.#wrapper = document.createElement("div");
      this.#wrapper.appendChild(this.#editor);
      this.#wrapper.appendChild(this.#heightBoost);
      this.#wrapper.classList.add(wrapper$2);
      this.#wrapper.addEventListener("scroll", this.#onContainerScroll);
      this.#wrapper.addEventListener("scrollend", this.#onContainerScrollEnd);
      this.#wrapper.addEventListener("mousemove", this.#onContainerMouseMove);
      this.#wrapper.addEventListener("mouseleave", this.#onContainerMouseLeave);
      this.#mountHelper = mountHelper(this.#wrapper);
    }
    mount(target) {
      this.#mountHelper.mount(target);
    }
    unmount() {
      this.#mountHelper.unmount();
    }
    setCallbacks(callbacks) {
      Object.assign(this.#callbacks, callbacks);
    }
    // onContentChanging(callback: ((editor: Editor) => void) | null) {
    // 	this.#onContentChangingCallback = callback;
    // }
    // onContentChanged(callback: ((editor: Editor) => void) | null) {
    // 	this.#onContentChangedCallback = callback;
    // }
    // onScroll(callback: ((editor: Editor) => void) | null) {
    // 	this.#onScrollCallback = callback;
    // }
    // onScrollEnd(callback: ((editor: Editor) => void) | null) {
    // 	this.#onScrollEndCallback = callback;
    // }
    // onResize(callback: ((editor: Editor) => void) | null) {
    // 	this.#onResizeCallback = callback;
    // }
    // onFocus(callback: ((editor: Editor) => void) | null) {
    // 	this.#onFocusCallback = callback;
    // }
    // onBlur(callback: ((editor: Editor) => void) | null) {
    // 	this.#onBlurCallback = callback;
    // }
    // onClick(callback: ((editor: Editor, event: MouseEvent) => void) | null) {
    // 	this.#onClickCallback = callback;
    // }
    // onCopy(callback: ((editor: Editor, event: ClipboardEvent) => void) | null) {
    // 	this.#onCopyCallback = callback;
    // }
    // onMouseMove(callback: (editor: Editor, e: MouseEvent) => void) {
    // 	this.#onMouseMoveCallback = callback;
    // }
    // onMouseLeave(callback: (editor: Editor, e: MouseEvent) => void) {
    // 	this.#onMouseLeaveCallback = callback;
    // }
    #onContainerScroll = () => {
      this.#callbacks.scroll?.(this);
    };
    #onContainerScrollEnd = () => {
      this.#callbacks.scrollEnd?.(this);
    };
    #onContainerMouseMove = (e) => {
      this.#callbacks.mouseMove?.(this, e);
    };
    #onContainerMouseLeave = (e) => {
      this.#callbacks.mouseLeave?.(this, e);
    };
    get name() {
      return this.#editorName;
    }
    get readonly() {
      return this.#readonly;
    }
    set readonly(value) {
      if (this.#readonly === value) {
        return;
      }
      this.#readonly = value;
      this.#editor.contentEditable = value ? "false" : "true";
    }
    get tokens() {
      return this.#tokens;
    }
    get container() {
      return this.#wrapper;
    }
    get editor() {
      return this.#editor;
    }
    get scrollTop() {
      return this.#wrapper?.scrollTop ?? 0;
    }
    set scrollTop(value) {
      if (this.#wrapper) {
        this.#wrapper.scrollTop = value;
      }
    }
    get scrollLeft() {
      return this.#wrapper?.scrollLeft ?? 0;
    }
    set scrollLeft(value) {
      if (this.#wrapper) {
        this.#wrapper.scrollLeft = value;
      }
    }
    #onKeyDown(e) {
      if (e.ctrlKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        if (this.#wrapper) {
          e.preventDefault();
          const fontSize = parseFloat(getComputedStyle(this.#editor).fontSize);
          const delta = (e.key === "ArrowUp" ? -LINE_HEIGHT : LINE_HEIGHT) * 2 * fontSize;
          this.#wrapper.scrollBy({
            top: delta,
            behavior: "instant"
          });
        }
      }
      if (e.altKey && (e.key === "2" || e.key === "3")) {
        const selection = document.getSelection();
        if (!selection || selection.rangeCount === 0) {
          return;
        }
        const range = selection.getRangeAt(0);
        if (!this.#editor.contains(range.commonAncestorContainer)) {
          return;
        }
        e.preventDefault();
        const html = e.key === "2" ? `<hr data-manual-anchor='A' class="manual-anchor">` : `<hr data-manual-anchor='B' class="manual-anchor">`;
        document.execCommand("insertHTML", false, html);
      }
    }
    #onInput() {
      this.#callbacks.contentChanging?.(this);
      this.#tokenize();
    }
    #onMutation(_mutations) {
    }
    observeMutation() {
      this.#mutationObserver.observe(this.#editor, {
        childList: true,
        subtree: true
        //attributes: true,
        //characterData: true,
      });
    }
    unobserveMutation() {
      this.#mutationObserver.disconnect();
    }
    #onCopy(e) {
      this.#callbacks.copy?.(this, e);
    }
    #onPaste(e) {
      const startTime = performance.now();
      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }
      const range = selection.getRangeAt(0);
      if (!this.#editor.contains(range.commonAncestorContainer)) {
        return;
      }
      e.preventDefault();
      let isHTML = true;
      let data = e.clipboardData?.getData("text/html") ?? "";
      if (!data) {
        isHTML = false;
        data = e.clipboardData?.getData("text/plain") ?? "";
      }
      this.#setContents({
        contents: data,
        asHTML: isHTML,
        targetRange: range,
        allowLegacyExecCommand: data.length <= (isHTML ? 1e4 : 1e3)
      });
      const endTime = performance.now();
      console.debug(this.#editorName, "Paste operation took", endTime - startTime, "ms");
    }
    getSelectionRange() {
      const selection = document.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return null;
      }
      const range = selection.getRangeAt(0);
      if (this.#editor.contains(range.startContainer) && this.#editor.contains(range.endContainer)) {
        return range;
      }
      return null;
    }
    /**
     * 폭탄 붙여넣기! 왜 bomb인가? 되돌릴 수 없기 때문. ctrl-z 안먹힘.
     * 전체 내용을 클립보드의 내용으로 교체함.
     * 또한 클립보드 액세스를 가능하게 하는 사용자의 동작 없이 실행이 되므로 브라우저에서 "허용" 여부를 묻는 경고창이 뜰 수 있음.
     */
    async pasteBomb(plaintextOnly = false) {
      const startTime = performance.now();
      if (!navigator.clipboard || !navigator.clipboard.read) {
        throw new Error("Clipboard API is not available in this browser");
      }
      this.#editor.contentEditable = "false";
      this.#editor.classList.add("busy");
      try {
        const items = await navigator.clipboard.read();
        let foundItem = null;
        let foundType = null;
        if (!plaintextOnly) {
          for (const item of items) {
            if (item.types.includes("text/html")) {
              foundItem = item;
              foundType = "text/html";
              break;
            }
          }
        }
        if (!foundItem) {
          for (const item of items) {
            if (item.types.includes("text/plain")) {
              foundItem = item;
              foundType = "text/plain";
              break;
            }
          }
        }
        if (!foundItem) {
          return false;
        }
        const text = await (await foundItem.getType(foundType)).text();
        this.#setContents({
          contents: text,
          asHTML: foundType === "text/html",
          targetRange: null,
          allowLegacyExecCommand: false
        });
        const endTime = performance.now();
        console.debug(this.#editorName, "Paste bomb operation took", endTime - startTime, "ms");
        return true;
      } finally {
        this.#editor.classList.remove("busy");
        this.#editor.contentEditable = "true";
      }
    }
    #setContents({
      contents,
      asHTML = false,
      targetRange,
      allowLegacyExecCommand = false
    }) {
      let sanitized;
      if (asHTML) {
        sanitized = sanitizeHTML(contents);
      } else {
        sanitized = createParagraphsFromText(contents);
      }
      try {
        this.unobserveMutation();
        if (targetRange === null) {
          this.#editor.innerHTML = "";
          this.#editor.appendChild(sanitized);
          this.#onInput();
        } else if (this.#editor.contains(targetRange.startContainer) && this.#editor.contains(targetRange.endContainer)) {
          if (allowLegacyExecCommand && contents.length <= 2e5) {
            const div = document.createElement("DIV");
            div.appendChild(sanitized);
            const sanitizedHTML = div.innerHTML;
            document.execCommand("insertHTML", false, sanitizedHTML);
          } else {
            targetRange.deleteContents();
            targetRange.insertNode(sanitized);
            targetRange.collapse(false);
            this.#onInput();
          }
        } else {
          throw new Error("Target range is not within the editor");
        }
      } finally {
        this.observeMutation();
      }
    }
    selectAll() {
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.selectNodeContents(this.#editor);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      }
      return false;
    }
    setContent(rawHTML) {
      this.unobserveMutation();
      let sanitized = sanitizeHTML(rawHTML);
      const range = document.createRange();
      range.selectNodeContents(this.#editor);
      range.deleteContents();
      range.insertNode(sanitized);
      range.collapse(false);
      this.#onInput();
      this.observeMutation();
    }
    findTokenOverlapIndices(range) {
      let low = 0;
      let high = this.#tokens.length - 1;
      let startIndex = -1;
      let endIndex = -1;
      const collapsed = range.collapsed;
      if (range.endContainer.nodeType === 3 && range.endOffset === range.endContainer.nodeValue.length) {
        let adjText = findAdjacentTextNode(range.endContainer, true);
        if (adjText) {
          range = range.cloneRange();
          range.setEnd(adjText, 0);
        }
      }
      try {
        const tokenRange = document.createRange();
        while (low <= high) {
          const mid = low + high >> 1;
          const token = this.#tokens[mid].range;
          tokenRange.setStart(token.startContainer, token.startOffset);
          tokenRange.setEnd(token.endContainer, token.endOffset);
          let c = range.compareBoundaryPoints(Range.END_TO_START, tokenRange);
          if (c < 0 || collapsed && c === 0) {
            if (startIndex !== -1 || (c = range.compareBoundaryPoints(Range.START_TO_END, tokenRange)) > 0 || collapsed && c === 0) {
              startIndex = mid;
            }
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }
        if (startIndex !== -1) {
          tokenRange.setStart(this.#tokens[startIndex].range.startContainer, this.#tokens[startIndex].range.startOffset);
          low = endIndex = startIndex;
          high = this.#tokens.length - 1;
          while (low <= high) {
            const mid = low + high >> 1;
            const token = this.#tokens[mid].range;
            tokenRange.setStart(token.startContainer, token.startOffset);
            tokenRange.setEnd(token.endContainer, token.endOffset);
            const c = range.compareBoundaryPoints(Range.START_TO_END, tokenRange);
            if (c > 0) {
              endIndex = mid + 1;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
        }
      } catch {
        startIndex = -1;
        endIndex = -1;
      }
      return endIndex >= 0 ? { start: startIndex, end: endIndex } : null;
    }
    getTokenRange(index, end = index + 1) {
      const range = document.createRange();
      const count = end - index;
      if (count === 1 && index >= 0 && index < this.#tokens.length) {
        const token = this.#tokens[index];
        range.setStart(token.range.startContainer, token.range.startOffset);
        range.setEnd(token.range.endContainer, token.range.endOffset);
      } else if (count > 0) {
        const startToken = this.#tokens[index];
        const endToken = this.#tokens[index + count - 1];
        if (startToken) {
          range.setStart(startToken.range.startContainer, startToken.range.startOffset);
        } else {
          range.setStart(this.#editor, 0);
        }
        if (endToken) {
          range.setEnd(endToken.range.endContainer, endToken.range.endOffset);
        } else {
          range.setEnd(this.#editor, this.#editor.childNodes.length);
        }
      } else {
        const prevToken = this.#tokens[index - 1];
        if (prevToken) {
          range.setStart(prevToken.range.endContainer, prevToken.range.endOffset);
        } else {
          range.setStart(this.#editor, 0);
        }
        const nextToken = this.#tokens[index];
        if (nextToken) {
          range.setEnd(nextToken.range.startContainer, nextToken.range.startOffset);
        } else {
          range.setEnd(this.#editor, this.#editor.childNodes.length);
        }
      }
      return range;
    }
    #tokenize() {
      if (this.#tokenizeContext) {
        this.#tokenizeContext.cancel();
      }
      this.#tokenizeContext = new TokenizeContext(this.#editor, (tokens) => {
        console.debug(this.#editorName, "Tokenization done", tokens);
        this.#tokens = tokens;
        this.#onTokenizeDone();
      });
      this.#tokenizeContext.start();
    }
    #onTokenizeDone() {
      this.#callbacks.contentChanged?.(this);
    }
    scrollTo(offset, options) {
      if (!this.#wrapper) {
        return;
      }
      if (this.#wrapper.scrollTop !== offset) {
        this.#wrapper.scrollTo({
          top: offset,
          behavior: options?.behavior
        });
      }
    }
    get scrollHeight() {
      return this.#editor.offsetHeight;
    }
    get contentHeight() {
      return this.#editor.offsetHeight;
    }
    focus() {
      this.#editor.focus();
    }
    contains(range) {
      if (!range || !this.#editor.contains(range.startContainer) || !this.#editor.contains(range.endContainer)) {
        return false;
      }
      return true;
    }
    set height(value) {
      const editorHeight = this.#editor.scrollHeight;
      const lifting = value - editorHeight;
      if (lifting < 0) {
        console.warn("WTF? The taller the better", this.#editorName, value, editorHeight);
        return;
      }
      if (lifting > 0) {
        this.#heightBoost.style.setProperty("--height-boost", lifting + "px");
      } else {
        this.#heightBoost.style.removeProperty("--height-boost");
      }
    }
    // 앵커를 에디터가 추적을 하긴 해야한다.
    // 그래야 앵커와 앵커 사이의 어떤 토큰들이 들어있는지 파악이 가능하다.
    // 그리고 그 토큰들을 사용해서 앵커와 앵커 사이에 어떤 diff가 있는지 파악 가능
    // 그리고 alignAnchors()가 되었을때 화면상 첫앵커와 끝앵커 사이의 diff geometries를 invalidate할 수 있다.
    // TODO
    removeDanglingAnchors() {
    }
    forceReflow() {
      if (!this.#wrapper) {
        return;
      }
      void this.#wrapper.offsetHeight;
    }
    getAnchorTargetForToken(range, _flags = AnchorFlags.None) {
      let node = range.startContainer;
      if (node.nodeType === 1 && node === range.endContainer && range.startOffset + 1 === range.endOffset) {
        const theNode = node.childNodes[range.startOffset];
        if (theNode.nodeName === DIFF_ELEMENT_NAME) {
          return theNode;
        }
      } else if (node.nodeType !== 3) {
        node = node.childNodes[range.startOffset];
        if (!node) {
          console.warn(this.#editorName, "getAnchorTargetForToken", "No child node found at the specified offset", range);
          return null;
        }
      }
      const ANCHOR_ELIGIBLE_ELEMENTS = {
        DIV: true,
        P: true,
        LI: true
      };
      let target = node;
      while (target && !ANCHOR_ELIGIBLE_ELEMENTS[target.nodeName]) {
        target = target.parentNode;
      }
      if (target === this.#editor) {
        return null;
      }
      return target;
    }
    getBoundingClientRect() {
      if (!this.#wrapper) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }
      return this.#wrapper.getBoundingClientRect();
    }
    getScroll() {
      if (!this.#wrapper) {
        return [0, 0];
      }
      return [this.#wrapper.scrollLeft, this.#wrapper.scrollTop];
    }
    padBottom(padding) {
      if (padding > 0) {
        this.#heightBoost.style.height = padding + "px";
      } else {
        this.#heightBoost.style.height = "0px";
      }
    }
    padHeight(height) {
      const delta = Math.max(height - this.#editor.offsetHeight, 0);
      this.#heightBoost.style.height = delta + "px";
    }
  }

  var wrapper$1 = 'Renderer_wrapper__1fhw0ut0';
  var diffLayer = 'Renderer_diffLayer__1fhw0ut1';
  var highlightLayer = 'Renderer_highlightLayer__1fhw0ut2';

  function mergeRects(rects, toleranceX = 0, toleranceY = 0) {
    rects.sort((a, b) => a.y - b.y || a.x - b.x);
    const merged = [];
    const used = new Array(rects.length).fill(false);
    let minX = Number.MAX_SAFE_INTEGER;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < rects.length; i++) {
      if (used[i]) continue;
      let base = rects[i];
      for (let j = i + 1; j < rects.length; j++) {
        if (used[j]) continue;
        const compare = rects[j];
        const sameY = Math.abs(base.y - compare.y) <= toleranceY && Math.abs(base.height - compare.height) <= toleranceY;
        if (!sameY) continue;
        const baseRight = base.x + base.width;
        const compareRight = compare.x + compare.width;
        const xOverlapOrClose = baseRight >= compare.x - toleranceX && compareRight >= base.x - toleranceX;
        if (xOverlapOrClose) {
          const newX = Math.min(base.x, compare.x);
          const newRight = Math.max(baseRight, compareRight);
          base = {
            x: newX,
            y: Math.min(base.y, compare.y),
            width: newRight - newX,
            height: Math.max(base.height, compare.height)
          };
          used[j] = true;
        }
      }
      merged.push(base);
      used[i] = true;
      minX = Math.min(minX, base.x);
      minY = Math.min(minY, base.y);
      maxX = Math.max(maxX, base.x + base.width);
      maxY = Math.max(maxY, base.y + base.height);
    }
    return {
      minX,
      minY,
      maxX,
      maxY,
      rects: merged
    };
  }

  const REGION_FLAGS_SHIFT = 10;
  const DIFF_EXPAND_X = 2;
  const DIFF_EXPAND_Y = 2;
  const DIFF_LINE_FILL_STYLE = "hsl(0 100% 90% / 0.5)";
  const DIFF_LINE_HEIGHT_MULTIPLIER = 1.2;
  const SELECTION_HIGHLIGHT_FILL_STYLE = "rgba(128, 128, 128, 0.3)";
  const GUIDELINE_STROKE_STYLE = "rgba(128, 128, 128, 0.3)";
  class Renderer {
    #wrapper = null;
    #canvas;
    #ctx;
    #highlightCanvas;
    #highlightCtx;
    #resizeObserver = new ResizeObserver(this.#handleResize.bind(this));
    #leftRegion;
    #rightRegion;
    #canvasX = 0;
    #canvasY = 0;
    #canvasWidth = 0;
    #canvasHeight = 0;
    #renderCallbackId = null;
    #nextRenderFlags = 0 /* NONE */;
    #mouseX = -1;
    #mouseY = -1;
    #guideLineEnabled = true;
    #guideLineY = -1;
    #stage = 0 /* Idle */;
    #onPrepareCallbackCallback = null;
    #onDrawCallbackCallback = null;
    #onDiffVisibilityChangedCallback = null;
    #onHoveredDiffIndexChangedCallback = null;
    #hoveredDiffIndex = null;
    #hoveredRegion = null;
    #mountHelper;
    constructor(left, right) {
      this.#canvas = document.createElement("canvas");
      this.#canvas.className = diffLayer;
      this.#ctx = this.#canvas.getContext("2d");
      this.#highlightCanvas = document.createElement("canvas");
      this.#highlightCanvas.className = highlightLayer;
      this.#highlightCtx = this.#highlightCanvas.getContext("2d");
      this.#leftRegion = new RenderRegion("left", this, left, this.#ctx, this.#highlightCtx);
      this.#rightRegion = new RenderRegion("right", this, right, this.#ctx, this.#highlightCtx);
      this.#wrapper = document.createElement("div");
      this.#wrapper.className = wrapper$1;
      this.#wrapper.appendChild(this.#canvas);
      this.#wrapper.appendChild(this.#highlightCanvas);
      this.#mountHelper = mountHelper(this.#wrapper, {
        onMount: (target) => {
          this.#resizeObserver.observe(target);
        },
        onUnmount: (target) => {
          this.#resizeObserver.unobserve(target);
        }
      });
    }
    mount(target) {
      this.#mountHelper.mount(target);
    }
    unmount() {
      this.#mountHelper.unmount();
    }
    get x() {
      return this.#canvasX;
    }
    get y() {
      return this.#canvasY;
    }
    get width() {
      return this.#canvasWidth;
    }
    get height() {
      return this.#canvasHeight;
    }
    get guideLineY() {
      return this.#guideLineY;
    }
    #handleResize(entries) {
      this.#updateLayout();
    }
    onPrepare(callback) {
      this.#onPrepareCallbackCallback = callback;
    }
    onDraw(callback) {
      this.#onDrawCallbackCallback = callback;
    }
    onDiffVisibilityChanged(callback) {
      this.#onDiffVisibilityChangedCallback = callback;
    }
    onHoveredDiffIndexChanged(callback) {
      this.#onHoveredDiffIndexChangedCallback = callback;
    }
    #onHighlightedDiffIndexChanged(diffIndex) {
      this.#leftRegion.setHoveredDiffIndex(diffIndex);
      this.#rightRegion.setHoveredDiffIndex(diffIndex);
    }
    get guideLineEnabled() {
      return this.#guideLineEnabled;
    }
    set guideLineEnabled(enabled) {
      enabled = !!enabled;
      if (this.#guideLineEnabled === enabled) {
        return;
      }
      this.#guideLineEnabled = enabled;
      this.#guideLineY = -1;
      if (enabled || this.#guideLineY !== null) {
        this.invalidateHighlightLayer(void 0);
      }
    }
    #updateLayout() {
      if (!this.#wrapper) {
        return;
      }
      const { x, y, width, height } = this.#wrapper.getBoundingClientRect();
      console.log("Rect:", x, y, width, height);
      this.#canvasX = x;
      this.#canvasY = y;
      if (this.#canvasWidth !== width || this.#canvasHeight !== height) {
        this.#canvas.width = this.#canvasWidth = width;
        this.#canvas.height = this.#canvasHeight = height;
        this.#nextRenderFlags = 3 /* GENERAL_MASK */ | 224 /* REGION_MASK */ | 224 /* REGION_MASK */ << REGION_FLAGS_SHIFT;
      }
      this.#highlightCanvas.width = width;
      this.#highlightCanvas.height = height;
      console.log("Canvas size:", this.#canvasWidth, this.#canvasHeight);
      this.#nextRenderFlags |= this.#leftRegion.updateLayout();
      this.#nextRenderFlags |= this.#rightRegion.updateLayout() << REGION_FLAGS_SHIFT;
    }
    updateMousePosition(x, y) {
      this.#mouseX = x - this.#canvasX;
      this.#mouseY = y - this.#canvasY;
      this.#invalidate(2 /* HIT_TEST */);
    }
    queueRender() {
      if (this.#renderCallbackId !== null) {
        return;
      }
      this.#renderCallbackId = requestAnimationFrame((ts) => {
        this.#renderCallbackId = null;
        this.#render(ts);
      });
    }
    cancelRender() {
      if (this.#renderCallbackId !== null) {
        cancelAnimationFrame(this.#renderCallbackId);
        this.#renderCallbackId = null;
        this.#nextRenderFlags = 0 /* NONE */;
        this.#stage = 0 /* Idle */;
      }
    }
    #render(time) {
      this.#stage = 1 /* Prepare */;
      this.#onPrepareCallbackCallback?.(time);
      if (this.#nextRenderFlags & 1 /* LAYOUT */) {
        this.#updateLayout();
      }
      let leftRegionFlags = this.#nextRenderFlags & 224 /* REGION_MASK */;
      let rightRegionFlags = this.#nextRenderFlags >> REGION_FLAGS_SHIFT & 224 /* REGION_MASK */;
      let leftDiffVisibilityChangeEntries = null;
      let rightDiffVisibilityChangeEntries = null;
      if (leftRegionFlags) {
        this.#leftRegion.prepare(leftRegionFlags);
        leftDiffVisibilityChangeEntries = this.#leftRegion.diffVisibilityChangeEntries;
      }
      if (rightRegionFlags) {
        this.#rightRegion.prepare(rightRegionFlags);
        rightDiffVisibilityChangeEntries = this.#rightRegion.diffVisibilityChangeEntries;
      }
      if (this.#nextRenderFlags & 2 /* HIT_TEST */) {
        this.hitTest(this.#mouseX, this.#mouseY);
        if (this.#guideLineEnabled) {
          if (this.#guideLineY !== this.#mouseY) {
            if (this.#guideLineY >= 0) {
              this.invalidateHighlightLayer();
            }
            this.#guideLineY = this.#mouseY;
          }
        }
      }
      this.#onDrawCallbackCallback?.(time);
      this.#stage = 2 /* Draw */;
      leftRegionFlags |= this.#nextRenderFlags & 224 /* REGION_MASK */;
      rightRegionFlags |= this.#nextRenderFlags >> REGION_FLAGS_SHIFT & 224 /* REGION_MASK */;
      this.#nextRenderFlags = 0 /* NONE */;
      if (leftRegionFlags) {
        this.#leftRegion.render(leftRegionFlags);
      }
      if (rightRegionFlags) {
        this.#rightRegion.render(rightRegionFlags);
      }
      if (this.#guideLineEnabled && this.#mouseY >= 0) {
        this.#renderGuideLine();
      }
      this.#stage = 0 /* Idle */;
      if (this.#nextRenderFlags !== 0 /* NONE */) {
        this.queueRender();
      }
      if (leftDiffVisibilityChangeEntries || rightDiffVisibilityChangeEntries) {
        const changes = {
          left: leftDiffVisibilityChangeEntries ?? [],
          right: rightDiffVisibilityChangeEntries ?? []
        };
        this.#onDiffVisibilityChangedCallback?.(changes);
      }
    }
    #renderGuideLine() {
      const ctx = this.#highlightCtx;
      const y = this.#guideLineY + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.#canvasWidth, y);
      ctx.strokeStyle = GUIDELINE_STROKE_STYLE;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    invalidateAll() {
      this.#invalidate(3 /* GENERAL_MASK */ | 224 /* REGION_MASK */ | 224 /* REGION_MASK */ << REGION_FLAGS_SHIFT);
    }
    invalidateLayout() {
      this.#invalidate(1 /* LAYOUT */);
    }
    invalidateDiffLayer(which) {
      return this.#invalidateRegion(32 /* DIFF_LAYER */, which);
    }
    invalidateHighlightLayer(which) {
      return this.#invalidateRegion(64 /* HIGHLIGHT_LAYER */, which);
    }
    invalidateGeometries(which) {
      return this.#invalidateRegion(128 /* GEOMETRY */ | 32 /* DIFF_LAYER */ | 64 /* HIGHLIGHT_LAYER */, which);
    }
    invalidateScroll(which) {
      return this.#invalidateRegion(96 /* SCROLL */, which);
    }
    #invalidate(flags) {
      this.#nextRenderFlags |= flags;
      if (this.#stage === 0 /* Idle */) {
        this.queueRender();
      } else if (this.#stage === 1 /* Prepare */) ; else if (this.#stage === 2 /* Draw */) ;
    }
    #invalidateRegion(flags, which) {
      if (which === "right") {
        flags <<= REGION_FLAGS_SHIFT;
      } else if (!which) {
        flags |= flags << REGION_FLAGS_SHIFT;
      }
      this.#invalidate(flags);
    }
    setDiffs(diffs) {
      const leftDiffs = new Array(diffs.length);
      const rightDiffs = new Array(diffs.length);
      for (let i = 0; i < diffs.length; i++) {
        const diff = diffs[i];
        const leftRange = diff.leftRange;
        const rightRange = diff.rightRange;
        leftDiffs[i] = {
          diffIndex: i,
          range: leftRange,
          hue: diff.hue,
          empty: diff.leftSpan.end === diff.leftSpan.start
        };
        rightDiffs[i] = {
          diffIndex: i,
          range: rightRange,
          hue: diff.hue,
          empty: diff.rightSpan.end === diff.rightSpan.start
        };
      }
      this.#leftRegion.setDiffs(leftDiffs);
      this.#rightRegion.setDiffs(rightDiffs);
      this.invalidateGeometries();
    }
    setDiffHighlight(diffIndex) {
      this.#leftRegion.setHoveredDiffIndex(diffIndex);
      this.#rightRegion.setHoveredDiffIndex(diffIndex);
    }
    setSelectionHighlight(which, range) {
      let leftRange = null;
      let rightRange = null;
      if (which === "left") {
        leftRange = range;
      } else if (which === "right") {
        rightRange = range;
      }
      this.#leftRegion.setSelectionHighlight(leftRange);
      this.#rightRegion.setSelectionHighlight(rightRange);
    }
    hitTest(x, y) {
      let diffIndex = null;
      if (x < 0 || y < 0) ; else if (x > this.#canvasWidth || y > this.#canvasHeight) ; else {
        let region = null;
        if (x >= this.#leftRegion.regionX && x < this.#leftRegion.regionX + this.#leftRegion.regionWidth && y >= this.#leftRegion.regionY && y < this.#leftRegion.regionY + this.#leftRegion.regionHeight) {
          region = this.#leftRegion;
        } else if (this.#rightRegion && x >= this.#rightRegion.regionX) {
          region = this.#rightRegion;
        }
        let diffIndex2 = null;
        let guideLineY = -1;
        if (region) {
          diffIndex2 = region.hitTest(x - region.regionX, y - region.regionY);
          guideLineY = y - region.regionY;
        }
        if (diffIndex2 !== this.#hoveredDiffIndex || region?.name !== this.#hoveredRegion) {
          this.#hoveredDiffIndex = diffIndex2;
          this.#hoveredRegion = region?.name ?? null;
          this.#onHoveredDiffIndexChangedCallback?.(diffIndex2);
        }
        if (this.#guideLineEnabled && this.#guideLineY !== guideLineY) {
          this.#guideLineY = guideLineY;
          this.invalidateHighlightLayer();
        }
      }
      return diffIndex;
    }
    getDiffRect(which, diffIndex) {
      const region = which === "left" ? this.#leftRegion : this.#rightRegion;
      return region?.getDiffRect(diffIndex) ?? null;
    }
  }
  class RenderRegion {
    #name;
    #renderer;
    #viewport;
    #diffs = [];
    #diffGeometries = [];
    #diffLineRects = [];
    #selectionHighlight = null;
    #selectionHighlightRects = null;
    //dirtyFlags: RenderFlags = RenderFlags.NONE;
    #visibleDiffIndices = /* @__PURE__ */ new Set();
    #ctx;
    #highlightCtx;
    regionX = 0;
    regionY = 0;
    regionWidth = 0;
    regionHeight = 0;
    #hoveredDiffIndex = null;
    #diffIndicesToRender = [];
    #scrollTop = 0;
    #scrollLeft = 0;
    // 의도적으로 public임.
    diffVisibilityChangeEntries = [];
    constructor(name, renderer, viewport, ctx, highlightCtx) {
      this.#name = name;
      this.#renderer = renderer;
      this.#ctx = ctx;
      this.#highlightCtx = highlightCtx;
      this.#viewport = viewport;
    }
    updateLayout() {
      let { x, y, width, height } = this.#viewport.getBoundingClientRect();
      const [scrollLeft, scrollTop] = this.#viewport.getScroll();
      x -= this.#renderer.x;
      y -= this.#renderer.y;
      let ret = 0 /* NONE */;
      if (this.regionX !== x || this.regionY !== y || this.regionWidth !== width || this.regionHeight !== height) {
        this.#renderer.invalidateGeometries(this.#name);
        ret = 224 /* RESIZE */;
      } else if (this.#scrollLeft !== scrollLeft || this.#scrollTop !== scrollTop) {
        this.#renderer.invalidateScroll(this.#name);
        ret = 96 /* SCROLL */;
      }
      this.regionX = x;
      this.regionY = y;
      this.regionWidth = width;
      this.regionHeight = height;
      this.#scrollLeft = scrollLeft;
      this.#scrollTop = scrollTop;
      return ret;
    }
    updateScroll(scrollTop, scrollLeft) {
      if (this.#scrollTop !== scrollTop || this.#scrollLeft !== scrollLeft) {
        this.#scrollTop = scrollTop;
        this.#scrollLeft = scrollLeft;
        this.#renderer.invalidateScroll(this.#name);
      }
    }
    get name() {
      return this.#name;
    }
    get diffs() {
      return this.#diffs;
    }
    get diffLineRects() {
      return this.#diffLineRects;
    }
    get selectionHighlight() {
      return this.#selectionHighlight;
    }
    get selectionHighlightRects() {
      return this.#selectionHighlightRects;
    }
    get visibleDiffIndices() {
      return this.#visibleDiffIndices;
    }
    // markDirty(flags: RenderFlags) {
    // 	this.dirtyFlags |= flags;
    // }
    setDiffs(diffs) {
      this.#diffs = diffs;
      this.#diffGeometries.length = 0;
      this.#visibleDiffIndices.clear();
      this.#selectionHighlight = null;
    }
    setHoveredDiffIndex(diffIndex) {
      if (this.#hoveredDiffIndex === diffIndex) {
        return false;
      }
      let wasShown = this.#hoveredDiffIndex !== null && this.visibleDiffIndices.has(this.#hoveredDiffIndex);
      let shouldShow = diffIndex !== null && (!this.#diffGeometries[diffIndex] || this.visibleDiffIndices.has(diffIndex));
      this.#hoveredDiffIndex = diffIndex;
      if (wasShown || shouldShow) {
        this.#renderer.invalidateHighlightLayer(this.#name);
        return true;
      }
      return false;
    }
    ensureGeometries() {
    }
    setSelectionHighlight(range) {
      const current = this.#selectionHighlight;
      if (current === range) {
        return false;
      }
      if (current && range && current.startContainer === range.startContainer && current.endContainer === range.endContainer && current.startOffset === range.startOffset && current.endOffset === range.endOffset) {
        return false;
      }
      this.#selectionHighlight = range;
      this.#selectionHighlightRects = null;
      this.#renderer.invalidateHighlightLayer(this.#name);
    }
    prepare(dirtyFlags) {
      [this.#scrollLeft, this.#scrollTop] = this.#viewport.getScroll();
      const diffGeometries = this.#diffGeometries;
      const diffsToRender = this.#diffIndicesToRender;
      const diffVisibilityChangeEntries = this.diffVisibilityChangeEntries;
      const visibleDiffIndices = this.#visibleDiffIndices;
      const diffs = this.#diffs;
      const newGeometryRects = [];
      diffsToRender.length = 0;
      diffVisibilityChangeEntries.length = 0;
      if (dirtyFlags & 128 /* GEOMETRY */) {
        diffGeometries.length = 0;
        this.#diffLineRects.length = 0;
      }
      const scrollTop = this.#scrollTop;
      const scrollLeft = this.#scrollLeft;
      const canvasX = this.#renderer.x;
      const canvasY = this.#renderer.y;
      const offsetTop = -this.regionY - canvasY + scrollTop;
      const offsetLeft = -this.regionX - canvasX + scrollLeft;
      const regionHeight = this.regionHeight;
      for (let diffIndex = 0; diffIndex < diffs.length; diffIndex++) {
        let geometry = diffGeometries[diffIndex];
        if (!geometry) {
          const diff = diffs[diffIndex];
          const wholeRect = diff.range.getBoundingClientRect();
          const x = wholeRect.x + offsetLeft - DIFF_EXPAND_X, y = wholeRect.y + offsetTop - DIFF_EXPAND_Y, width = wholeRect.width + DIFF_EXPAND_X * 2, height = wholeRect.height + DIFF_EXPAND_Y * 2;
          diffGeometries[diffIndex] = geometry = {
            minX: x,
            minY: y,
            maxX: x + width,
            maxY: y + height,
            rects: null
            // fillStyle: null,
            // strokeStyle: null,
          };
        }
        if (geometry.maxY - scrollTop < 0 || geometry.minY - scrollTop > regionHeight || geometry.maxX - scrollLeft < 0 || geometry.minX - scrollLeft > this.regionWidth) {
          if (visibleDiffIndices.delete(diffIndex)) {
            diffVisibilityChangeEntries.push({ item: diffIndex, isVisible: false });
          }
          continue;
        }
        if (geometry.rects === null) {
          const rangeRects = extractRects(diffs[diffIndex].range, diffs[diffIndex].empty);
          for (const rect of rangeRects) {
            rect.x += offsetLeft - DIFF_EXPAND_X;
            rect.y += offsetTop - DIFF_EXPAND_Y;
            rect.width += DIFF_EXPAND_X * 2;
            rect.height += DIFF_EXPAND_Y * 2;
            newGeometryRects.push(rect);
          }
          diffGeometries[diffIndex] = geometry = mergeRects(rangeRects, 1, 1);
        }
        diffsToRender.push(diffIndex);
      }
      if (newGeometryRects.length > 0) {
        this.#mergeIntoDiffLineRects(newGeometryRects);
      }
    }
    render(dirtyFlags) {
      if (dirtyFlags & 32 /* DIFF_LAYER */) {
        this.renderDiffLayer();
      }
      if (dirtyFlags & 64 /* HIGHLIGHT_LAYER */) {
        this.renderHighlightLayer(dirtyFlags);
      }
    }
    renderDiffLayer() {
      const ctx = this.#ctx;
      ctx.save();
      ctx.translate(this.regionX, this.regionY);
      ctx.clearRect(0, 0, this.regionWidth, this.regionHeight);
      ctx.beginPath();
      ctx.rect(0, 0, this.regionWidth, this.regionHeight);
      ctx.clip();
      const diffGeometries = this.#diffGeometries;
      const diffsToRender = this.#diffIndicesToRender;
      const diffVisibilityChangeEntries = this.diffVisibilityChangeEntries;
      const visibleDiffIndices = this.#visibleDiffIndices;
      const diffs = this.#diffs;
      const scrollTop = this.#scrollTop;
      const scrollLeft = this.#scrollLeft;
      const regionHeight = this.regionHeight;
      for (const diffLineRect of this.#diffLineRects) {
        const x = Math.floor(diffLineRect.x - scrollLeft), y = Math.floor(diffLineRect.y - scrollTop), width = Math.ceil(diffLineRect.width), height = Math.ceil(diffLineRect.height);
        if (y + height < 0) continue;
        if (y > regionHeight) break;
        ctx.fillStyle = DIFF_LINE_FILL_STYLE;
        ctx.fillRect(x, y, width, height);
      }
      for (const diffIndex of diffsToRender) {
        const geometry = diffGeometries[diffIndex];
        ctx.fillStyle = `hsl(${diffs[diffIndex].hue} 100% 80%)`;
        ctx.strokeStyle = `hsl(${diffs[diffIndex].hue} 100% 40%)`;
        let rendered = false;
        for (const rect of geometry.rects) {
          const x = Math.floor(rect.x - scrollLeft), y = Math.floor(rect.y - scrollTop), width = Math.ceil(rect.width), height = Math.ceil(rect.height);
          if (y + height < 0) continue;
          if (y + height < 0 || y > regionHeight) break;
          ctx.fillRect(x, y, width, height);
          rendered = true;
        }
        if (rendered) {
          const prevCount = visibleDiffIndices.size;
          visibleDiffIndices.add(diffIndex);
          if (visibleDiffIndices.size > prevCount) {
            diffVisibilityChangeEntries.push({ item: diffIndex, isVisible: true });
          }
        } else {
          if (visibleDiffIndices.delete(diffIndex)) {
            diffVisibilityChangeEntries.push({ item: diffIndex, isVisible: false });
          }
        }
      }
      ctx.restore();
    }
    renderHighlightLayer(dirtyFlags) {
      const ctx = this.#highlightCtx;
      ctx.save();
      ctx.translate(this.regionX, this.regionY);
      ctx.clearRect(0, 0, this.regionWidth, this.regionHeight);
      ctx.beginPath();
      ctx.rect(0, 0, this.regionWidth, this.regionHeight);
      ctx.clip();
      const regionWidth = this.regionWidth;
      const regionHeight = this.regionHeight;
      const scrollTop = this.#scrollTop;
      const scrollLeft = this.#scrollLeft;
      if (this.#hoveredDiffIndex !== null) {
        const rects = this.#diffGeometries[this.#hoveredDiffIndex];
        if (rects && rects.rects) {
          let isVisible = !(rects.maxY - scrollTop < 0 || rects.minY - scrollTop > regionHeight) && !(rects.maxX - scrollLeft < 0 || rects.minX - scrollLeft > regionWidth);
          if (isVisible) {
            ctx.lineWidth = 2;
            ctx.fillStyle = `hsl(0 100% 80%)`;
            ctx.strokeStyle = `hsl(0 100% 50% / 0.5)`;
            for (const rect of rects.rects) {
              const x = Math.floor(rect.x - scrollLeft), y = Math.floor(rect.y - scrollTop), width = Math.ceil(rect.width), height = Math.ceil(rect.height);
              if (y + height < 0 || y > regionHeight) continue;
              if (x + width < 0 || x > regionWidth) continue;
              ctx.fillRect(x, y, width, height);
            }
            ctx.lineWidth = 1;
          }
        }
      }
      if (this.#selectionHighlight) {
        if (!this.#selectionHighlightRects || dirtyFlags & 128 /* GEOMETRY */) {
          performance.now();
          const offsetX = -this.regionX + scrollLeft;
          const offsetY = -this.regionY + scrollTop;
          const rawRects = extractRects(this.#selectionHighlight);
          performance.now();
          const mergedRect = mergeRects(rawRects, 1, 1);
          if (mergedRect.rects) {
            for (const rect of mergedRect.rects) {
              rect.x += offsetX;
              rect.y += offsetY;
            }
            mergedRect.minX += offsetX;
            mergedRect.minY += offsetY;
            mergedRect.maxX += offsetX;
            mergedRect.maxY += offsetY;
            this.#selectionHighlightRects = mergedRect;
          }
        }
        let geometry = this.#selectionHighlightRects;
        let isVisible = !(geometry.maxY - scrollTop < 0 || geometry.minY - scrollTop > regionHeight) && !(geometry.maxX - scrollLeft < 0 || geometry.minX - scrollLeft > regionWidth);
        if (isVisible) {
          ctx.fillStyle = SELECTION_HIGHLIGHT_FILL_STYLE;
          for (const rect of geometry.rects) {
            const x = Math.floor(rect.x - scrollLeft), y = Math.floor(rect.y - scrollTop), width = Math.ceil(rect.width), height = Math.ceil(rect.height);
            if (y + height < 0) continue;
            if (y > regionHeight) break;
            ctx.fillRect(x, y, width, height);
          }
        }
      }
      if (this.#renderer.guideLineEnabled && this.#renderer.guideLineY >= 0) {
        const guideLineY = this.#renderer.guideLineY + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, guideLineY);
        ctx.lineTo(this.regionWidth, guideLineY);
        ctx.strokeStyle = GUIDELINE_STROKE_STYLE;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();
    }
    #mergeIntoDiffLineRects(incoming) {
      const TOLERANCE = 1;
      const regionWidth = this.regionWidth;
      const allRects = [];
      for (const rect of this.#diffLineRects) {
        allRects.push(rect);
      }
      for (const rect of incoming) {
        const height = rect.height * DIFF_LINE_HEIGHT_MULTIPLIER;
        const heightDelta = height - rect.height;
        const y = rect.y - heightDelta / 2;
        allRects.push({
          x: 0,
          y,
          width: regionWidth,
          height
        });
      }
      allRects.sort((a, b) => a.y - b.y);
      this.#diffLineRects.length = 0;
      let current = allRects[0];
      for (let i = 1; i < allRects.length; i++) {
        const next = allRects[i];
        const gap = next.y - (current.y + current.height);
        if (gap <= TOLERANCE) {
          const newBottom = Math.max(current.y + current.height, next.y + next.height);
          current = {
            x: 0,
            y: current.y,
            width: regionWidth,
            height: newBottom - current.y
          };
        } else {
          this.#diffLineRects.push(current);
          current = next;
        }
      }
      this.#diffLineRects.push(current);
    }
    hitTest(x, y) {
      x += this.#scrollLeft;
      y += this.#scrollTop;
      for (const diffIndex of this.#visibleDiffIndices) {
        const geometry = this.#diffGeometries[diffIndex];
        if (geometry && geometry.rects) {
          for (const rect of geometry.rects) {
            if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
              return diffIndex;
            }
          }
        }
      }
      return null;
    }
    getDiffAtPoint(x, y) {
      for (const diffIndex of this.#visibleDiffIndices) {
        const geometry = this.#diffGeometries[diffIndex];
        if (!geometry || !geometry.rects) {
          continue;
        }
        for (const rect of geometry.rects) {
          if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
            return diffIndex;
          }
        }
      }
      return null;
    }
    getDiffRect(diffIndex) {
      const geometry = this.#diffGeometries[diffIndex];
      if (geometry) {
        return {
          x: geometry.minX,
          y: geometry.minY,
          width: geometry.maxX - geometry.minX,
          height: geometry.maxY - geometry.minY
        };
      }
      return null;
    }
  }
  function extractRects(sourceRange, emptyDiff = false) {
    const result = [];
    const tempRange = document.createRange();
    let startNode;
    if (sourceRange.startContainer.nodeType === 3) {
      tempRange.setStart(sourceRange.startContainer, sourceRange.startOffset);
      if (emptyDiff) {
        tempRange.collapse(true);
      } else {
        if (sourceRange.startContainer === sourceRange.endContainer) {
          tempRange.setEnd(sourceRange.startContainer, sourceRange.endOffset);
        } else {
          tempRange.setEnd(sourceRange.startContainer, sourceRange.startContainer.nodeValue.length);
        }
      }
      for (const rect of tempRange.getClientRects()) {
        result.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        });
        if (emptyDiff && (rect.x !== 0 || rect.y !== 0)) {
          return result;
        }
      }
      startNode = advanceNode(sourceRange.startContainer);
    } else {
      startNode = sourceRange.startContainer.childNodes[sourceRange.startOffset];
      if (!startNode) {
        startNode = advanceNode(sourceRange.startContainer, null, true);
        if (!startNode) {
          console.warn("extractRects: No startNode found", sourceRange);
          return result;
        }
      }
    }
    const endContainer = sourceRange.endContainer;
    let endOffset;
    let endNode;
    if (endContainer.nodeType === 3) {
      endNode = endContainer;
      endOffset = sourceRange.endOffset;
    } else {
      endNode = endContainer.childNodes[sourceRange.endOffset];
      if (!endNode) {
        endNode = advanceNode(endContainer, null, true);
      }
      endOffset = -1;
    }
    const walker = document.createTreeWalker(sourceRange.commonAncestorContainer, NodeFilter.SHOW_ALL);
    if (!startNode || !endNode) {
      console.warn("extractRects: No startNode or endNode", sourceRange);
      return result;
    }
    if (endNode.compareDocumentPosition(startNode) & Node.DOCUMENT_POSITION_FOLLOWING) {
      return result;
    }
    walker.currentNode = startNode;
    do {
      const currentNode = walker.currentNode;
      if (!currentNode) {
        console.error("extractRects: currentNode is null", sourceRange);
      }
      if (currentNode === endNode) {
        if (currentNode.nodeType === 3 && endOffset >= 0) {
          tempRange.setStart(endNode, 0);
          if (emptyDiff) {
            tempRange.collapse(true);
          } else {
            tempRange.setEnd(endNode, endOffset);
          }
          for (const rect of tempRange.getClientRects()) {
            result.push({
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            });
            if (emptyDiff && (rect.x !== 0 || rect.y !== 0)) {
              return result;
            }
          }
        }
        break;
      }
      if (currentNode.nodeType === 3) {
        tempRange.selectNodeContents(currentNode);
        for (const rect of tempRange.getClientRects()) {
          result.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          });
        }
      } else if (currentNode.nodeName === "BR") ; else if (currentNode.nodeName === DIFF_ELEMENT_NAME) {
        if (emptyDiff && currentNode.classList.contains("diff")) {
          const tempText = document.createTextNode("​");
          currentNode.appendChild(tempText);
          tempRange.selectNodeContents(tempText);
          for (const rect of tempRange.getClientRects()) {
            result.push({
              x: rect.x,
              y: rect.y - 1.5,
              width: rect.width,
              height: rect.height
            });
          }
          tempText.remove();
        } else {
          if (currentNode.classList.contains("manual-anchor")) {
            tempRange.selectNode(currentNode);
            for (const rect of currentNode.getClientRects()) {
              result.push({
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              });
            }
          }
        }
      } else if (currentNode.nodeName === "IMG") {
        tempRange.selectNode(currentNode);
        for (const rect of tempRange.getClientRects()) {
          result.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          });
        }
      }
    } while (walker.nextNode());
    return result;
  }

  const DiffEngineContext = React.createContext(null);
  function DiffEngineProvider({ value, children }) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(DiffEngineContext.Provider, { value, children });
  }
  function useDiffEngineContext() {
    const context = React.useContext(DiffEngineContext);
    if (!context) {
      throw new Error("useDiffEngineContext must be used within a DiffEngineProvider");
    }
    return context;
  }

  var editorShell = 'EditorShell_editorShell__12kfwnu0';

  function r(e){var t,f,n="";if("string"==typeof e||"number"==typeof e)n+=e;else if("object"==typeof e)if(Array.isArray(e)){var o=e.length;for(t=0;t<o;t++)e[t]&&(f=r(e[t]))&&(n&&(n+=" "),n+=f);}else for(f in e)e[f]&&(n&&(n+=" "),n+=f);return n}function clsx(){for(var e,t,f=0,n="",o=arguments.length;f<o;f++)(e=arguments[f])&&(t=r(e))&&(n&&(n+=" "),n+=t);return n}

  const EditorShell = React.forwardRef(({ editor, className }, ref) => {
    const containerRef = React.useRef(null);
    React.useEffect(() => {
      if (!containerRef.current) return;
      editor.mount(containerRef.current);
      return () => {
        editor.unmount();
      };
    }, [editor, containerRef.current]);
    React.useImperativeHandle(ref, () => ({
      getEditor: () => editor,
      getRootElement: () => containerRef.current
    }));
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: clsx(editorShell, className), ref: containerRef });
  });

  var rendererShell = 'RendererShell_rendererShell__rh59wk0';

  function RendererShell({ renderer, className }) {
    const containerRef = React.useRef(null);
    React.useEffect(() => {
      if (!containerRef.current) return;
      renderer.mount(containerRef.current);
      return () => {
        renderer.unmount();
      };
    }, []);
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: clsx(rendererShell, className), ref: containerRef });
  }

  const __vite_import_meta_env__$3 = {};
  const isSelfAtom = (atom, a) => atom.unstable_is ? atom.unstable_is(a) : a === atom;
  const hasInitialValue = (atom) => "init" in atom;
  const isActuallyWritableAtom = (atom) => !!atom.write;
  const isAtomStateInitialized = (atomState) => "v" in atomState || "e" in atomState;
  const returnAtomValue = (atomState) => {
    if ("e" in atomState) {
      throw atomState.e;
    }
    if ((__vite_import_meta_env__$3 ? "production" : void 0) !== "production" && !("v" in atomState)) {
      throw new Error("[Bug] atom state is not initialized");
    }
    return atomState.v;
  };
  const promiseStateMap = /* @__PURE__ */ new WeakMap();
  const isPendingPromise = (value) => {
    var _a;
    return isPromiseLike$1(value) && !!((_a = promiseStateMap.get(value)) == null ? void 0 : _a[0]);
  };
  const abortPromise = (promise) => {
    const promiseState = promiseStateMap.get(promise);
    if (promiseState == null ? void 0 : promiseState[0]) {
      promiseState[0] = false;
      promiseState[1].forEach((fn) => fn());
    }
  };
  const registerAbortHandler = (promise, abortHandler) => {
    let promiseState = promiseStateMap.get(promise);
    if (!promiseState) {
      promiseState = [true, /* @__PURE__ */ new Set()];
      promiseStateMap.set(promise, promiseState);
      const settle = () => {
        promiseState[0] = false;
      };
      promise.then(settle, settle);
    }
    promiseState[1].add(abortHandler);
  };
  const isPromiseLike$1 = (p) => typeof (p == null ? void 0 : p.then) === "function";
  const addPendingPromiseToDependency = (atom, promise, dependencyAtomState) => {
    if (!dependencyAtomState.p.has(atom)) {
      dependencyAtomState.p.add(atom);
      promise.then(
        () => {
          dependencyAtomState.p.delete(atom);
        },
        () => {
          dependencyAtomState.p.delete(atom);
        }
      );
    }
  };
  const setAtomStateValueOrPromise = (atom, valueOrPromise, ensureAtomState) => {
    const atomState = ensureAtomState(atom);
    const hasPrevValue = "v" in atomState;
    const prevValue = atomState.v;
    if (isPromiseLike$1(valueOrPromise)) {
      for (const a of atomState.d.keys()) {
        addPendingPromiseToDependency(atom, valueOrPromise, ensureAtomState(a));
      }
    }
    atomState.v = valueOrPromise;
    delete atomState.e;
    if (!hasPrevValue || !Object.is(prevValue, atomState.v)) {
      ++atomState.n;
      if (isPromiseLike$1(prevValue)) {
        abortPromise(prevValue);
      }
    }
  };
  const getMountedOrPendingDependents = (atom, atomState, mountedMap) => {
    var _a;
    const dependents = /* @__PURE__ */ new Set();
    for (const a of ((_a = mountedMap.get(atom)) == null ? void 0 : _a.t) || []) {
      if (mountedMap.has(a)) {
        dependents.add(a);
      }
    }
    for (const atomWithPendingPromise of atomState.p) {
      dependents.add(atomWithPendingPromise);
    }
    return dependents;
  };
  const createStoreHook = () => {
    const callbacks = /* @__PURE__ */ new Set();
    const notify = () => {
      callbacks.forEach((fn) => fn());
    };
    notify.add = (fn) => {
      callbacks.add(fn);
      return () => {
        callbacks.delete(fn);
      };
    };
    return notify;
  };
  const createStoreHookForAtoms = () => {
    const all = {};
    const callbacks = /* @__PURE__ */ new WeakMap();
    const notify = (atom) => {
      var _a, _b;
      (_a = callbacks.get(all)) == null ? void 0 : _a.forEach((fn) => fn(atom));
      (_b = callbacks.get(atom)) == null ? void 0 : _b.forEach((fn) => fn());
    };
    notify.add = (atom, fn) => {
      const key = atom || all;
      const fns = (callbacks.has(key) ? callbacks : callbacks.set(key, /* @__PURE__ */ new Set())).get(key);
      fns.add(fn);
      return () => {
        fns == null ? void 0 : fns.delete(fn);
        if (!fns.size) {
          callbacks.delete(key);
        }
      };
    };
    return notify;
  };
  const initializeStoreHooks = (storeHooks) => {
    storeHooks.c || (storeHooks.c = createStoreHookForAtoms());
    storeHooks.m || (storeHooks.m = createStoreHookForAtoms());
    storeHooks.u || (storeHooks.u = createStoreHookForAtoms());
    storeHooks.f || (storeHooks.f = createStoreHook());
    return storeHooks;
  };
  const BUILDING_BLOCKS = Symbol();
  const buildStore = (atomStateMap = /* @__PURE__ */ new WeakMap(), mountedMap = /* @__PURE__ */ new WeakMap(), invalidatedAtoms = /* @__PURE__ */ new WeakMap(), changedAtoms = /* @__PURE__ */ new Set(), mountCallbacks = /* @__PURE__ */ new Set(), unmountCallbacks = /* @__PURE__ */ new Set(), storeHooks = {}, atomRead = (atom, ...params) => atom.read(...params), atomWrite = (atom, ...params) => atom.write(...params), atomOnInit = (atom, store) => {
    var _a;
    return (_a = atom.unstable_onInit) == null ? void 0 : _a.call(atom, store);
  }, atomOnMount = (atom, setAtom) => {
    var _a;
    return (_a = atom.onMount) == null ? void 0 : _a.call(atom, setAtom);
  }, ...buildingBlockFunctions) => {
    const ensureAtomState = buildingBlockFunctions[0] || ((atom) => {
      if ((__vite_import_meta_env__$3 ? "production" : void 0) !== "production" && !atom) {
        throw new Error("Atom is undefined or null");
      }
      let atomState = atomStateMap.get(atom);
      if (!atomState) {
        atomState = { d: /* @__PURE__ */ new Map(), p: /* @__PURE__ */ new Set(), n: 0 };
        atomStateMap.set(atom, atomState);
        atomOnInit == null ? void 0 : atomOnInit(atom, store);
      }
      return atomState;
    });
    const flushCallbacks = buildingBlockFunctions[1] || (() => {
      const errors = [];
      const call = (fn) => {
        try {
          fn();
        } catch (e) {
          errors.push(e);
        }
      };
      do {
        if (storeHooks.f) {
          call(storeHooks.f);
        }
        const callbacks = /* @__PURE__ */ new Set();
        const add = callbacks.add.bind(callbacks);
        changedAtoms.forEach((atom) => {
          var _a;
          return (_a = mountedMap.get(atom)) == null ? void 0 : _a.l.forEach(add);
        });
        changedAtoms.clear();
        unmountCallbacks.forEach(add);
        unmountCallbacks.clear();
        mountCallbacks.forEach(add);
        mountCallbacks.clear();
        callbacks.forEach(call);
        if (changedAtoms.size) {
          recomputeInvalidatedAtoms();
        }
      } while (changedAtoms.size || unmountCallbacks.size || mountCallbacks.size);
      if (errors.length) {
        throw new AggregateError(errors);
      }
    });
    const recomputeInvalidatedAtoms = buildingBlockFunctions[2] || (() => {
      const topSortedReversed = [];
      const visiting = /* @__PURE__ */ new WeakSet();
      const visited = /* @__PURE__ */ new WeakSet();
      const stack = Array.from(changedAtoms);
      while (stack.length) {
        const a = stack[stack.length - 1];
        const aState = ensureAtomState(a);
        if (visited.has(a)) {
          stack.pop();
          continue;
        }
        if (visiting.has(a)) {
          if (invalidatedAtoms.get(a) === aState.n) {
            topSortedReversed.push([a, aState]);
          } else if ((__vite_import_meta_env__$3 ? "production" : void 0) !== "production" && invalidatedAtoms.has(a)) {
            throw new Error("[Bug] invalidated atom exists");
          }
          visited.add(a);
          stack.pop();
          continue;
        }
        visiting.add(a);
        for (const d of getMountedOrPendingDependents(a, aState, mountedMap)) {
          if (!visiting.has(d)) {
            stack.push(d);
          }
        }
      }
      for (let i = topSortedReversed.length - 1; i >= 0; --i) {
        const [a, aState] = topSortedReversed[i];
        let hasChangedDeps = false;
        for (const dep of aState.d.keys()) {
          if (dep !== a && changedAtoms.has(dep)) {
            hasChangedDeps = true;
            break;
          }
        }
        if (hasChangedDeps) {
          readAtomState(a);
          mountDependencies(a);
        }
        invalidatedAtoms.delete(a);
      }
    });
    const readAtomState = buildingBlockFunctions[3] || ((atom) => {
      var _a;
      const atomState = ensureAtomState(atom);
      if (isAtomStateInitialized(atomState)) {
        if (mountedMap.has(atom) && invalidatedAtoms.get(atom) !== atomState.n) {
          return atomState;
        }
        if (Array.from(atomState.d).every(
          ([a, n]) => (
            // Recursively, read the atom state of the dependency, and
            // check if the atom epoch number is unchanged
            readAtomState(a).n === n
          )
        )) {
          return atomState;
        }
      }
      atomState.d.clear();
      let isSync = true;
      const mountDependenciesIfAsync = () => {
        if (mountedMap.has(atom)) {
          mountDependencies(atom);
          recomputeInvalidatedAtoms();
          flushCallbacks();
        }
      };
      const getter = (a) => {
        var _a2;
        if (isSelfAtom(atom, a)) {
          const aState2 = ensureAtomState(a);
          if (!isAtomStateInitialized(aState2)) {
            if (hasInitialValue(a)) {
              setAtomStateValueOrPromise(a, a.init, ensureAtomState);
            } else {
              throw new Error("no atom init");
            }
          }
          return returnAtomValue(aState2);
        }
        const aState = readAtomState(a);
        try {
          return returnAtomValue(aState);
        } finally {
          atomState.d.set(a, aState.n);
          if (isPendingPromise(atomState.v)) {
            addPendingPromiseToDependency(atom, atomState.v, aState);
          }
          (_a2 = mountedMap.get(a)) == null ? void 0 : _a2.t.add(atom);
          if (!isSync) {
            mountDependenciesIfAsync();
          }
        }
      };
      let controller;
      let setSelf;
      const options = {
        get signal() {
          if (!controller) {
            controller = new AbortController();
          }
          return controller.signal;
        },
        get setSelf() {
          if ((__vite_import_meta_env__$3 ? "production" : void 0) !== "production" && !isActuallyWritableAtom(atom)) {
            console.warn("setSelf function cannot be used with read-only atom");
          }
          if (!setSelf && isActuallyWritableAtom(atom)) {
            setSelf = (...args) => {
              if ((__vite_import_meta_env__$3 ? "production" : void 0) !== "production" && isSync) {
                console.warn("setSelf function cannot be called in sync");
              }
              if (!isSync) {
                try {
                  return writeAtomState(atom, ...args);
                } finally {
                  recomputeInvalidatedAtoms();
                  flushCallbacks();
                }
              }
            };
          }
          return setSelf;
        }
      };
      const prevEpochNumber = atomState.n;
      try {
        const valueOrPromise = atomRead(atom, getter, options);
        setAtomStateValueOrPromise(atom, valueOrPromise, ensureAtomState);
        if (isPromiseLike$1(valueOrPromise)) {
          registerAbortHandler(valueOrPromise, () => controller == null ? void 0 : controller.abort());
          valueOrPromise.then(
            mountDependenciesIfAsync,
            mountDependenciesIfAsync
          );
        }
        return atomState;
      } catch (error) {
        delete atomState.v;
        atomState.e = error;
        ++atomState.n;
        return atomState;
      } finally {
        isSync = false;
        if (prevEpochNumber !== atomState.n && invalidatedAtoms.get(atom) === prevEpochNumber) {
          invalidatedAtoms.set(atom, atomState.n);
          changedAtoms.add(atom);
          (_a = storeHooks.c) == null ? void 0 : _a.call(storeHooks, atom);
        }
      }
    });
    const invalidateDependents = buildingBlockFunctions[4] || ((atom) => {
      const stack = [atom];
      while (stack.length) {
        const a = stack.pop();
        const aState = ensureAtomState(a);
        for (const d of getMountedOrPendingDependents(a, aState, mountedMap)) {
          const dState = ensureAtomState(d);
          invalidatedAtoms.set(d, dState.n);
          stack.push(d);
        }
      }
    });
    const writeAtomState = buildingBlockFunctions[5] || ((atom, ...args) => {
      let isSync = true;
      const getter = (a) => returnAtomValue(readAtomState(a));
      const setter = (a, ...args2) => {
        var _a;
        const aState = ensureAtomState(a);
        try {
          if (isSelfAtom(atom, a)) {
            if (!hasInitialValue(a)) {
              throw new Error("atom not writable");
            }
            const prevEpochNumber = aState.n;
            const v = args2[0];
            setAtomStateValueOrPromise(a, v, ensureAtomState);
            mountDependencies(a);
            if (prevEpochNumber !== aState.n) {
              changedAtoms.add(a);
              (_a = storeHooks.c) == null ? void 0 : _a.call(storeHooks, a);
              invalidateDependents(a);
            }
            return void 0;
          } else {
            return writeAtomState(a, ...args2);
          }
        } finally {
          if (!isSync) {
            recomputeInvalidatedAtoms();
            flushCallbacks();
          }
        }
      };
      try {
        return atomWrite(atom, getter, setter, ...args);
      } finally {
        isSync = false;
      }
    });
    const mountDependencies = buildingBlockFunctions[6] || ((atom) => {
      var _a;
      const atomState = ensureAtomState(atom);
      const mounted = mountedMap.get(atom);
      if (mounted && !isPendingPromise(atomState.v)) {
        for (const [a, n] of atomState.d) {
          if (!mounted.d.has(a)) {
            const aState = ensureAtomState(a);
            const aMounted = mountAtom(a);
            aMounted.t.add(atom);
            mounted.d.add(a);
            if (n !== aState.n) {
              changedAtoms.add(a);
              (_a = storeHooks.c) == null ? void 0 : _a.call(storeHooks, a);
              invalidateDependents(a);
            }
          }
        }
        for (const a of mounted.d || []) {
          if (!atomState.d.has(a)) {
            mounted.d.delete(a);
            const aMounted = unmountAtom(a);
            aMounted == null ? void 0 : aMounted.t.delete(atom);
          }
        }
      }
    });
    const mountAtom = buildingBlockFunctions[7] || ((atom) => {
      var _a;
      const atomState = ensureAtomState(atom);
      let mounted = mountedMap.get(atom);
      if (!mounted) {
        readAtomState(atom);
        for (const a of atomState.d.keys()) {
          const aMounted = mountAtom(a);
          aMounted.t.add(atom);
        }
        mounted = {
          l: /* @__PURE__ */ new Set(),
          d: new Set(atomState.d.keys()),
          t: /* @__PURE__ */ new Set()
        };
        mountedMap.set(atom, mounted);
        (_a = storeHooks.m) == null ? void 0 : _a.call(storeHooks, atom);
        if (isActuallyWritableAtom(atom)) {
          const processOnMount = () => {
            let isSync = true;
            const setAtom = (...args) => {
              try {
                return writeAtomState(atom, ...args);
              } finally {
                if (!isSync) {
                  recomputeInvalidatedAtoms();
                  flushCallbacks();
                }
              }
            };
            try {
              const onUnmount = atomOnMount(atom, setAtom);
              if (onUnmount) {
                mounted.u = () => {
                  isSync = true;
                  try {
                    onUnmount();
                  } finally {
                    isSync = false;
                  }
                };
              }
            } finally {
              isSync = false;
            }
          };
          mountCallbacks.add(processOnMount);
        }
      }
      return mounted;
    });
    const unmountAtom = buildingBlockFunctions[8] || ((atom) => {
      var _a;
      const atomState = ensureAtomState(atom);
      let mounted = mountedMap.get(atom);
      if (mounted && !mounted.l.size && !Array.from(mounted.t).some((a) => {
        var _a2;
        return (_a2 = mountedMap.get(a)) == null ? void 0 : _a2.d.has(atom);
      })) {
        if (mounted.u) {
          unmountCallbacks.add(mounted.u);
        }
        mounted = void 0;
        mountedMap.delete(atom);
        (_a = storeHooks.u) == null ? void 0 : _a.call(storeHooks, atom);
        for (const a of atomState.d.keys()) {
          const aMounted = unmountAtom(a);
          aMounted == null ? void 0 : aMounted.t.delete(atom);
        }
        return void 0;
      }
      return mounted;
    });
    const buildingBlocks = [
      // store state
      atomStateMap,
      mountedMap,
      invalidatedAtoms,
      changedAtoms,
      mountCallbacks,
      unmountCallbacks,
      storeHooks,
      // atom interceptors
      atomRead,
      atomWrite,
      atomOnInit,
      atomOnMount,
      // building-block functions
      ensureAtomState,
      flushCallbacks,
      recomputeInvalidatedAtoms,
      readAtomState,
      invalidateDependents,
      writeAtomState,
      mountDependencies,
      mountAtom,
      unmountAtom
    ];
    const store = {
      get: (atom) => returnAtomValue(readAtomState(atom)),
      set: (atom, ...args) => {
        try {
          return writeAtomState(atom, ...args);
        } finally {
          recomputeInvalidatedAtoms();
          flushCallbacks();
        }
      },
      sub: (atom, listener) => {
        const mounted = mountAtom(atom);
        const listeners = mounted.l;
        listeners.add(listener);
        flushCallbacks();
        return () => {
          listeners.delete(listener);
          unmountAtom(atom);
          flushCallbacks();
        };
      }
    };
    Object.defineProperty(store, BUILDING_BLOCKS, { value: buildingBlocks });
    return store;
  };
  const INTERNAL_buildStoreRev1 = buildStore;
  const INTERNAL_initializeStoreHooks = initializeStoreHooks;
  const INTERNAL_registerAbortHandler = registerAbortHandler;

  const __vite_import_meta_env__$2 = {};
  let keyCount = 0;
  function atom(read, write) {
    const key = `atom${++keyCount}`;
    const config = {
      toString() {
        return (__vite_import_meta_env__$2 ? "production" : void 0) !== "production" && this.debugLabel ? key + ":" + this.debugLabel : key;
      }
    };
    if (typeof read === "function") {
      config.read = read;
    } else {
      config.init = read;
      config.read = defaultRead;
      config.write = defaultWrite;
    }
    if (write) {
      config.write = write;
    }
    return config;
  }
  function defaultRead(get) {
    return get(this);
  }
  function defaultWrite(get, set, arg) {
    return set(
      this,
      typeof arg === "function" ? arg(get(this)) : arg
    );
  }
  const createDevStoreRev4 = () => {
    let inRestoreAtom = 0;
    const storeHooks = INTERNAL_initializeStoreHooks({});
    const atomStateMap = /* @__PURE__ */ new WeakMap();
    const mountedAtoms = /* @__PURE__ */ new WeakMap();
    const store = INTERNAL_buildStoreRev1(
      atomStateMap,
      mountedAtoms,
      void 0,
      void 0,
      void 0,
      void 0,
      storeHooks,
      void 0,
      (atom2, get, set, ...args) => {
        if (inRestoreAtom) {
          return set(atom2, ...args);
        }
        return atom2.write(get, set, ...args);
      }
    );
    const debugMountedAtoms = /* @__PURE__ */ new Set();
    storeHooks.m.add(void 0, (atom2) => {
      debugMountedAtoms.add(atom2);
      const atomState = atomStateMap.get(atom2);
      atomState.m = mountedAtoms.get(atom2);
    });
    storeHooks.u.add(void 0, (atom2) => {
      debugMountedAtoms.delete(atom2);
      const atomState = atomStateMap.get(atom2);
      delete atomState.m;
    });
    const devStore = {
      // store dev methods (these are tentative and subject to change without notice)
      dev4_get_internal_weak_map: () => {
        console.log("Deprecated: Use devstore from the devtools library");
        return atomStateMap;
      },
      dev4_get_mounted_atoms: () => debugMountedAtoms,
      dev4_restore_atoms: (values) => {
        const restoreAtom = {
          read: () => null,
          write: (_get, set) => {
            ++inRestoreAtom;
            try {
              for (const [atom2, value] of values) {
                if ("init" in atom2) {
                  set(atom2, value);
                }
              }
            } finally {
              --inRestoreAtom;
            }
          }
        };
        store.set(restoreAtom);
      }
    };
    return Object.assign(store, devStore);
  };
  function createStore() {
    if ((__vite_import_meta_env__$2 ? "production" : void 0) !== "production") {
      return createDevStoreRev4();
    }
    return INTERNAL_buildStoreRev1();
  }
  let defaultStore;
  function getDefaultStore() {
    if (!defaultStore) {
      defaultStore = createStore();
      if ((__vite_import_meta_env__$2 ? "production" : void 0) !== "production") {
        globalThis.__JOTAI_DEFAULT_STORE__ || (globalThis.__JOTAI_DEFAULT_STORE__ = defaultStore);
        if (globalThis.__JOTAI_DEFAULT_STORE__ !== defaultStore) {
          console.warn(
            "Detected multiple Jotai instances. It may cause unexpected behavior with the default store. https://github.com/pmndrs/jotai/discussions/2044"
          );
        }
      }
    }
    return defaultStore;
  }

  const __vite_import_meta_env__$1 = {};
  const StoreContext = React.createContext(
    void 0
  );
  function useStore(options) {
    const store = React.useContext(StoreContext);
    return store || getDefaultStore();
  }
  const isPromiseLike = (x) => typeof (x == null ? void 0 : x.then) === "function";
  const attachPromiseStatus = (promise) => {
    if (!promise.status) {
      promise.status = "pending";
      promise.then(
        (v) => {
          promise.status = "fulfilled";
          promise.value = v;
        },
        (e) => {
          promise.status = "rejected";
          promise.reason = e;
        }
      );
    }
  };
  const use = React.use || // A shim for older React versions
  ((promise) => {
    if (promise.status === "pending") {
      throw promise;
    } else if (promise.status === "fulfilled") {
      return promise.value;
    } else if (promise.status === "rejected") {
      throw promise.reason;
    } else {
      attachPromiseStatus(promise);
      throw promise;
    }
  });
  const continuablePromiseMap = /* @__PURE__ */ new WeakMap();
  const createContinuablePromise = (promise, getValue) => {
    let continuablePromise = continuablePromiseMap.get(promise);
    if (!continuablePromise) {
      continuablePromise = new Promise((resolve, reject) => {
        let curr = promise;
        const onFulfilled = (me) => (v) => {
          if (curr === me) {
            resolve(v);
          }
        };
        const onRejected = (me) => (e) => {
          if (curr === me) {
            reject(e);
          }
        };
        const onAbort = () => {
          try {
            const nextValue = getValue();
            if (isPromiseLike(nextValue)) {
              continuablePromiseMap.set(nextValue, continuablePromise);
              curr = nextValue;
              nextValue.then(onFulfilled(nextValue), onRejected(nextValue));
              INTERNAL_registerAbortHandler(nextValue, onAbort);
            } else {
              resolve(nextValue);
            }
          } catch (e) {
            reject(e);
          }
        };
        promise.then(onFulfilled(promise), onRejected(promise));
        INTERNAL_registerAbortHandler(promise, onAbort);
      });
      continuablePromiseMap.set(promise, continuablePromise);
    }
    return continuablePromise;
  };
  function useAtomValue(atom, options) {
    const { delay, unstable_promiseStatus: promiseStatus = !React.use } = {};
    const store = useStore();
    const [[valueFromReducer, storeFromReducer, atomFromReducer], rerender] = React.useReducer(
      (prev) => {
        const nextValue = store.get(atom);
        if (Object.is(prev[0], nextValue) && prev[1] === store && prev[2] === atom) {
          return prev;
        }
        return [nextValue, store, atom];
      },
      void 0,
      () => [store.get(atom), store, atom]
    );
    let value = valueFromReducer;
    if (storeFromReducer !== store || atomFromReducer !== atom) {
      rerender();
      value = store.get(atom);
    }
    React.useEffect(() => {
      const unsub = store.sub(atom, () => {
        if (promiseStatus) {
          try {
            const value2 = store.get(atom);
            if (isPromiseLike(value2)) {
              attachPromiseStatus(
                createContinuablePromise(value2, () => store.get(atom))
              );
            }
          } catch (e) {
          }
        }
        if (typeof delay === "number") {
          setTimeout(rerender, delay);
          return;
        }
        rerender();
      });
      rerender();
      return unsub;
    }, [store, atom, delay, promiseStatus]);
    React.useDebugValue(value);
    if (isPromiseLike(value)) {
      const promise = createContinuablePromise(value, () => store.get(atom));
      if (promiseStatus) {
        attachPromiseStatus(promise);
      }
      return use(promise);
    }
    return value;
  }
  function useSetAtom(atom, options) {
    const store = useStore();
    const setAtom = React.useCallback(
      (...args) => {
        if ((__vite_import_meta_env__$1 ? "production" : void 0) !== "production" && !("write" in atom)) {
          throw new Error("not writable atom");
        }
        return store.set(atom, ...args);
      },
      [store, atom]
    );
    return setAtom;
  }
  function useAtom(atom, options) {
    return [
      useAtomValue(atom),
      // We do wrong type assertion here, which results in throwing an error.
      useSetAtom(atom)
    ];
  }

  const __vite_import_meta_env__ = {};
  const RESET = Symbol(
    (__vite_import_meta_env__ ? "production" : void 0) !== "production" ? "RESET" : ""
  );
  const isPromiseLike$3 = (x) => typeof (x == null ? void 0 : x.then) === "function";
  function createJSONStorage(getStringStorage = () => {
    try {
      return window.localStorage;
    } catch (e) {
      if ((__vite_import_meta_env__ ? "production" : void 0) !== "production") {
        if (typeof window !== "undefined") {
          console.warn(e);
        }
      }
      return void 0;
    }
  }, options) {
    var _a;
    let lastStr;
    let lastValue;
    const storage = {
      getItem: (key, initialValue) => {
        var _a2, _b;
        const parse = (str2) => {
          str2 = str2 || "";
          if (lastStr !== str2) {
            try {
              lastValue = JSON.parse(str2, options == null ? void 0 : options.reviver);
            } catch (e) {
              return initialValue;
            }
            lastStr = str2;
          }
          return lastValue;
        };
        const str = (_b = (_a2 = getStringStorage()) == null ? void 0 : _a2.getItem(key)) != null ? _b : null;
        if (isPromiseLike$3(str)) {
          return str.then(parse);
        }
        return parse(str);
      },
      setItem: (key, newValue) => {
        var _a2;
        return (_a2 = getStringStorage()) == null ? void 0 : _a2.setItem(
          key,
          JSON.stringify(newValue, void 0 )
        );
      },
      removeItem: (key) => {
        var _a2;
        return (_a2 = getStringStorage()) == null ? void 0 : _a2.removeItem(key);
      }
    };
    const createHandleSubscribe = (subscriber2) => (key, callback, initialValue) => subscriber2(key, (v) => {
      let newValue;
      try {
        newValue = JSON.parse(v || "");
      } catch (e) {
        newValue = initialValue;
      }
      callback(newValue);
    });
    let subscriber;
    try {
      subscriber = (_a = getStringStorage()) == null ? void 0 : _a.subscribe;
    } catch (e) {
    }
    if (!subscriber && typeof window !== "undefined" && typeof window.addEventListener === "function" && window.Storage) {
      subscriber = (key, callback) => {
        if (!(getStringStorage() instanceof window.Storage)) {
          return () => {
          };
        }
        const storageEventCallback = (e) => {
          if (e.storageArea === getStringStorage() && e.key === key) {
            callback(e.newValue);
          }
        };
        window.addEventListener("storage", storageEventCallback);
        return () => {
          window.removeEventListener("storage", storageEventCallback);
        };
      };
    }
    if (subscriber) {
      storage.subscribe = createHandleSubscribe(subscriber);
    }
    return storage;
  }
  const defaultStorage = createJSONStorage();
  function atomWithStorage(key, initialValue, storage = defaultStorage, options) {
    const baseAtom = atom(
      initialValue
    );
    if ((__vite_import_meta_env__ ? "production" : void 0) !== "production") {
      baseAtom.debugPrivate = true;
    }
    baseAtom.onMount = (setAtom) => {
      setAtom(storage.getItem(key, initialValue));
      let unsub;
      if (storage.subscribe) {
        unsub = storage.subscribe(key, setAtom, initialValue);
      }
      return unsub;
    };
    const anAtom = atom(
      (get) => get(baseAtom),
      (get, set, update) => {
        const nextValue = typeof update === "function" ? update(get(baseAtom)) : update;
        if (nextValue === RESET) {
          set(baseAtom, initialValue);
          return storage.removeItem(key);
        }
        if (isPromiseLike$3(nextValue)) {
          return nextValue.then((resolvedValue) => {
            set(baseAtom, resolvedValue);
            return storage.setItem(key, resolvedValue);
          });
        }
        set(baseAtom, nextValue);
        return storage.setItem(key, nextValue);
      }
    );
    return anAtom;
  }

  atom([]);
  const syncModeAtom = atom(false);
  const visibleDiffsAtom = atom({
    left: /* @__PURE__ */ new Set(),
    right: /* @__PURE__ */ new Set()
  });
  const hoveredDiffIndexAtom = atom(null);
  const editorPanelLayoutAtom = atomWithStorage("editorPanelLayout", "horizontal");
  const magnifierEnabledAtom = atomWithStorage("magnifierEnabled", true);

  function toPrimitive(t, r) {
    if ("object" != typeof t || !t) return t;
    var e = t[Symbol.toPrimitive];
    if (void 0 !== e) {
      var i = e.call(t, r);
      if ("object" != typeof i) return i;
      throw new TypeError("@@toPrimitive must return a primitive value.");
    }
    return ("string" === r ? String : Number)(t);
  }

  function toPropertyKey(t) {
    var i = toPrimitive(t, "string");
    return "symbol" == typeof i ? i : String(i);
  }

  function _defineProperty(obj, key, value) {
    key = toPropertyKey(key);
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }
    return obj;
  }

  function ownKeys(e, r) {
    var t = Object.keys(e);
    if (Object.getOwnPropertySymbols) {
      var o = Object.getOwnPropertySymbols(e);
      r && (o = o.filter(function (r) {
        return Object.getOwnPropertyDescriptor(e, r).enumerable;
      })), t.push.apply(t, o);
    }
    return t;
  }
  function _objectSpread2(e) {
    for (var r = 1; r < arguments.length; r++) {
      var t = null != arguments[r] ? arguments[r] : {};
      r % 2 ? ownKeys(Object(t), true).forEach(function (r) {
        _defineProperty(e, r, t[r]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
        Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
      });
    }
    return e;
  }

  function mapValues(input, fn) {
    var result = {};
    for (var _key in input) {
      result[_key] = fn(input[_key], _key);
    }
    return result;
  }

  var shouldApplyCompound = (compoundCheck, selections, defaultVariants) => {
    for (var key of Object.keys(compoundCheck)) {
      var _selections$key;
      if (compoundCheck[key] !== ((_selections$key = selections[key]) !== null && _selections$key !== void 0 ? _selections$key : defaultVariants[key])) {
        return false;
      }
    }
    return true;
  };
  var createRuntimeFn = config => {
    var runtimeFn = options => {
      var className = config.defaultClassName;
      var selections = _objectSpread2(_objectSpread2({}, config.defaultVariants), options);
      for (var variantName in selections) {
        var _selections$variantNa;
        var variantSelection = (_selections$variantNa = selections[variantName]) !== null && _selections$variantNa !== void 0 ? _selections$variantNa : config.defaultVariants[variantName];
        if (variantSelection != null) {
          var selection = variantSelection;
          if (typeof selection === 'boolean') {
            // @ts-expect-error
            selection = selection === true ? 'true' : 'false';
          }
          var selectionClassName =
          // @ts-expect-error
          config.variantClassNames[variantName][selection];
          if (selectionClassName) {
            className += ' ' + selectionClassName;
          }
        }
      }
      for (var [compoundCheck, compoundClassName] of config.compoundVariants) {
        if (shouldApplyCompound(compoundCheck, selections, config.defaultVariants)) {
          className += ' ' + compoundClassName;
        }
      }
      return className;
    };
    runtimeFn.variants = () => Object.keys(config.variantClassNames);
    runtimeFn.classNames = {
      get base() {
        return config.defaultClassName.split(' ')[0];
      },
      get variants() {
        return mapValues(config.variantClassNames, classNames => mapValues(classNames, className => className.split(' ')[0]));
      }
    };
    return runtimeFn;
  };

  var container$2 = createRuntimeFn({defaultClassName:'EditorPanel_container__183fy150',variantClassNames:{layout:{vertical:'EditorPanel_container_layout_vertical__183fy151',horizontal:'EditorPanel_container_layout_horizontal__183fy152'},syncMode:{on:'EditorPanel_container_syncMode_on__183fy153',off:'EditorPanel_container_syncMode_off__183fy154'}},defaultVariants:{syncMode:'off'},compoundVariants:[]});

  function EditorPanel({}) {
    const { leftEditor, rightEditor, renderer } = useDiffEngineContext();
    const containerRef = React.useRef(null);
    React.useEffect(() => {
    });
    React.useEffect(() => {
      if (!containerRef.current) return;
      const leftEditorContainer = document.createElement("div");
      const rightEditorContainer = document.createElement("div");
      const rendererContainer = document.createElement("div");
      containerRef.current.appendChild(leftEditorContainer);
      leftEditor.mount(leftEditorContainer);
      rightEditor.mount(rightEditorContainer);
      renderer.mount(rendererContainer);
      return () => {
        leftEditor.unmount();
        rightEditor.unmount();
        renderer.unmount();
        containerRef.current?.removeChild(leftEditorContainer);
        containerRef.current?.removeChild(rightEditorContainer);
        containerRef.current?.removeChild(rendererContainer);
      };
    }, [leftEditor, rightEditor, renderer, containerRef.current]);
    const syncMode = useAtomValue(syncModeAtom);
    const layout = useAtomValue(editorPanelLayoutAtom);
    const leftEditorShell = React.useMemo(() => /* @__PURE__ */ jsxRuntimeExports.jsx(EditorShell, { editor: leftEditor }), [leftEditor]);
    const rightEditorShell = React.useMemo(() => /* @__PURE__ */ jsxRuntimeExports.jsx(EditorShell, { editor: rightEditor }), [rightEditor]);
    const rendererShell = React.useMemo(() => /* @__PURE__ */ jsxRuntimeExports.jsx(RendererShell, { renderer }), [renderer]);
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: container$2({
      layout: layout === "vertical" ? "vertical" : "horizontal",
      syncMode: syncMode ? "on" : "off"
    }), children: [
      leftEditorShell,
      rightEditorShell,
      rendererShell
    ] });
  }

  function useDiffContext() {
    const { diffController: diffEngine } = useDiffEngineContext();
    const [ctx, setCtx] = React.useState(diffEngine.diffContext);
    React.useEffect(() => {
      const off = diffEngine.onDiffDone((diffContext) => {
        setCtx(diffContext);
      });
      return off;
    }, [diffEngine]);
    return ctx;
  }

  var listWrapper = 'DiffList_listWrapper__11u1ks00';
  var diffList = 'DiffList_diffList__11u1ks01';
  var diffListItem = 'DiffList_diffListItem__11u1ks02';
  var diffCard = 'DiffList_diffCard__11u1ks03';
  var rangeText = 'DiffList_rangeText__11u1ks04';

  function DiffList({ className, ...props }) {
    const { diffController } = useDiffEngineContext();
    const diffContext = useDiffContext();
    const items = diffContext?.diffs ?? [];
    const { left: leftVisibleDiffs, right: rightVisibleDiffs } = useAtomValue(visibleDiffsAtom);
    const onItemClick = React.useCallback((e, diffIndex) => {
      e.preventDefault();
      const toEnd = e.shiftKey;
      let primary = void 0;
      if (e.target instanceof HTMLElement) {
        if (e.target.classList.contains("left")) {
          primary = "left";
        } else if (e.target.classList.contains("right")) {
          primary = "right";
        }
      }
      diffController.scrollToDiff(diffIndex, { primary, toEnd });
    }, [diffController]);
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: clsx(listWrapper, className), ...props, children: /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: diffList, children: items.map((item) => /* @__PURE__ */ jsxRuntimeExports.jsx(
      DiffListItem,
      {
        diff: item,
        leftVisible: leftVisibleDiffs.has(item.diffIndex),
        rightVisible: rightVisibleDiffs.has(item.diffIndex),
        onDiffClick: onItemClick
      },
      item.diffIndex
    )) }) });
  }
  function DiffListItem({
    diff,
    onDiffClick,
    leftVisible,
    rightVisible,
    className
  }) {
    const hue = diff.hue;
    return /* @__PURE__ */ jsxRuntimeExports.jsx("li", { className: clsx(diffListItem, className), children: /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: clsx(
          diffCard,
          leftVisible ? "left-visible" : "left-hidden",
          rightVisible ? "right-visible" : "right-hidden"
        ),
        style: { "--diff-hue": hue },
        onClick: (e) => onDiffClick(e, diff.diffIndex),
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: clsx("left", rangeText), children: diff.leftRange.toString() }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: clsx("right", rangeText), children: diff.rightRange.toString() })
        ]
      }
    ) });
  }

  var sidebar = 'AppSidebar_sidebar__1nmrnq00';

  function AppSidebar() {
    return /* @__PURE__ */ jsxRuntimeExports.jsx("aside", { className: sidebar, children: /* @__PURE__ */ jsxRuntimeExports.jsx(DiffList, {}) });
  }

  function tokenizeByChar(text, _options) {
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      const charCode = text.codePointAt(i);
      const normCode = charCode;
      if (charCode === void 0) {
        throw new Error(`Invalid character at index ${i}`);
      }
      const count = charCode > 65535 ? 2 : 1;
      tokens.push({
        char: String.fromCodePoint(normCode),
        count,
        index: i
      });
      i += count;
    }
    return tokens;
  }

  function quickDiff(leftText, rightText, options) {
    const A = tokenizeByChar(leftText);
    const B = tokenizeByChar(rightText);
    const dp = Array(A.length + 1).fill(null).map(() => Array(B.length + 1).fill(0));
    for (let i2 = A.length - 1; i2 >= 0; i2--) {
      for (let j2 = B.length - 1; j2 >= 0; j2--) {
        if (A[i2].char === B[j2].char) {
          dp[i2][j2] = dp[i2 + 1][j2 + 1] + 1;
        } else {
          dp[i2][j2] = Math.max(dp[i2 + 1][j2], dp[i2][j2 + 1]);
        }
      }
    }
    let i = 0, j = 0;
    const diffs = [];
    while (i < A.length || j < B.length) {
      if (i < A.length && j < B.length && A[i].char === B[j].char) {
        diffs.push({
          type: 0,
          left: { start: A[i].index, end: A[i].index + A[i].count },
          // `index`는 이제 실제 문자열의 인덱스
          right: { start: B[j].index, end: B[j].index + B[j].count }
        });
        i++;
        j++;
      } else if (i < A.length && (j >= B.length || dp[i + 1][j] >= dp[i][j + 1])) {
        diffs.push({
          type: 1,
          left: { start: A[i].index, end: A[i].index + A[i].count },
          // `index`는 이제 실제 문자열의 인덱스
          right: null
          //{ start: B[j].index, end: B[j].index }, // `index`는 그대로 사용
        });
        i++;
      } else if (j < B.length) {
        diffs.push({
          type: 2,
          left: null,
          //{ start: A[i].index, end: A[i].index }, // `index`는 그대로 사용
          right: { start: B[j].index, end: B[j].index + B[j].count }
          // `index`는 그대로 사용
        });
        j++;
      }
    }
    return diffs;
  }
  let ricId = null;
  function requestQuickDiff(leftText, rightText, options, onComplete) {
    if (ricId !== null) {
      cancelIdleCallback(ricId);
    }
    ricId = requestIdleCallback(() => {
      const result = quickDiff(leftText, rightText);
      onComplete(result);
      ricId = null;
    });
  }

  var container$1 = 'SectionTrail_container__c1fe8g0';
  var copyButton = 'SectionTrail_copyButton__c1fe8g1';
  var trailBlock = 'SectionTrail_trailBlock__c1fe8g2';
  var ordinal = 'SectionTrail_ordinal__c1fe8g3';
  var title = 'SectionTrail_title__c1fe8g4';
  var separator = 'SectionTrail_separator__c1fe8g5';

  function Trail({ trail }) {
    const [copied, setCopied] = React.useState(false);
    const copyTrail = () => {
      const text = trail.map((h) => `${h.ordinalText} ${h.title}`).join(" › ");
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1e3);
      });
    };
    return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: container$1, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: copyButton, onClick: copyTrail, children: copied ? "✓" : "#" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("dl", { className: trailBlock, children: trail.map((h, i) => /* @__PURE__ */ jsxRuntimeExports.jsxs(React.Fragment, { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("dt", { className: ordinal, children: h.ordinalText }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("dd", { className: title, children: [
          " ",
          h.title,
          i < trail.length - 1 && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: separator, children: "›" })
        ] })
      ] }, i)) })
    ] });
  }
  function SectionTrail({ leftTrail, rightTrail }) {
    if (leftTrail.length === 0 && rightTrail.length === 0) return null;
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(Trail, { trail: leftTrail }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Trail, { trail: rightTrail })
    ] });
  }

  var label = 'EditableLabel _label__6pycza0';
  var input = 'EditableLabel _input__6pycza1';
  var placeholder = 'EditableLabel _placeholder__6pycza2';

  function EditableLabel({
    value,
    onCommit,
    onCancel,
    className = ""
  }) {
    const [editing, setEditing] = React.useState(false);
    const [draft, setDraft] = React.useState(value);
    const inputRef = React.useRef(null);
    React.useEffect(() => {
      if (editing) {
        setDraft(value);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    }, [editing, value]);
    const commit = () => {
      const trimmed = draft.trim();
      if (trimmed !== value) onCommit(trimmed);
      setEditing(false);
    };
    const cancel = () => {
      onCancel?.();
      setEditing(false);
    };
    if (editing) {
      return /* @__PURE__ */ jsxRuntimeExports.jsx(
        "input",
        {
          ref: inputRef,
          value: draft,
          onChange: (e) => setDraft(e.target.value),
          onBlur: cancel,
          onKeyDown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          },
          className: clsx(input, className)
        }
      );
    }
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      "span",
      {
        onDoubleClick: () => setEditing(true),
        className: clsx(label, className),
        children: value || /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: placeholder, children: "empty" })
      }
    );
  }

  var wrapper = 'Magnifier_wrapper__1sbw3n20';
  var header = 'Magnifier_header__1sbw3n22';
  var select = 'Magnifier_select__1sbw3n23';
  var trail = 'Magnifier_trail__1sbw3n24';
  var tooLongText = 'Magnifier_tooLongText__1sbw3n25';
  var warningText = 'Magnifier_warningText__1sbw3n26';
  var hintText = 'Magnifier_hintText__1sbw3n27';
  var loading = 'Magnifier_loading__1sbw3n28';
  var body = 'Magnifier_body__1sbw3n29';
  var equal = 'Magnifier_equal__1sbw3n2a';
  var delete_ = 'Magnifier_delete___1sbw3n2b';
  var insert = 'Magnifier_insert__1sbw3n2c';
  var container = 'Magnifier_container__1sbw3n2d';
  var row = 'Magnifier_row__1sbw3n2e';
  var col = 'Magnifier_col__1sbw3n2f';
  var textBlock = 'Magnifier_textBlock__1sbw3n2g';
  var dividerRow = 'Magnifier_dividerRow__1sbw3n2h';
  var dividerCol = 'Magnifier_dividerCol__1sbw3n2i';
  var flexRow = 'Magnifier_flexRow__1sbw3n2j';
  var closeButton = 'Magnifier_closeButton__1sbw3n2k';
  var noItalic = 'Magnifier_noItalic__1sbw3n2l';

  const diffOptions = {};
  const MagnifierMaxTextLength = 500;
  function Magnifier({ leftText, rightText, leftTrail, rightTrail, options }) {
    const lastInputOutput = React.useRef({ left: "", right: "", options: diffOptions, diffs: [] });
    const { updateOptions, hide } = useMagnifier();
    const containerRef = React.useRef(null);
    const [entries, setEntries] = React.useState(null);
    const renderMode = options.renderMode || "inline";
    const tooLong = leftText.length > MagnifierMaxTextLength || rightText.length > MagnifierMaxTextLength;
    const posX = options.posX;
    const posY = options.posY;
    React.useEffect(() => {
      if (tooLong) {
        return;
      }
      if (lastInputOutput.current.left !== leftText || lastInputOutput.current.right !== rightText || lastInputOutput.current.options !== diffOptions) {
        lastInputOutput.current.left = leftText;
        lastInputOutput.current.right = rightText;
        lastInputOutput.current.options = diffOptions;
        lastInputOutput.current.diffs = null;
        setEntries(null);
        requestQuickDiff(leftText, rightText, diffOptions, (result) => {
          setEntries(result);
        });
      }
    }, [leftText, rightText, diffOptions]);
    const adjustPosition = React.useCallback((x, y) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      let newLeft = x ?? rect.left;
      let newTop = y ?? rect.top;
      if (newLeft + el.offsetWidth > window.innerWidth) {
        newLeft = window.innerWidth - el.offsetWidth;
      }
      if (newTop + el.offsetHeight > window.innerHeight) {
        newTop = window.innerHeight - el.offsetHeight;
      }
      if (newLeft < 0) newLeft = 0;
      if (newTop < 0) newTop = 0;
      const clampedLeft = newLeft;
      const clampedTop = newTop;
      el.style.left = `${clampedLeft}px`;
      el.style.top = `${clampedTop}px`;
      updateOptions({
        posX: clampedLeft,
        posY: clampedTop
      });
    }, []);
    const onMouseDown = React.useCallback((e) => {
      const el = containerRef.current;
      if (!el || e.target.tagName === "SELECT") return;
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = el.getBoundingClientRect();
      const offsetX = startX - rect.left;
      const offsetY = startY - rect.top;
      const onMouseMove = (moveEvent) => {
        if (!el) return;
        const newLeft = moveEvent.clientX - offsetX;
        const newTop = moveEvent.clientY - offsetY;
        const clampedLeft = Math.max(0, Math.min(newLeft, window.innerWidth - el.offsetWidth));
        const clampedTop = Math.max(0, Math.min(newTop, window.innerHeight - el.offsetHeight));
        el.style.left = `${clampedLeft}px`;
        el.style.top = `${clampedTop}px`;
        updateOptions({
          posX: clampedLeft,
          posY: clampedTop
        });
      };
      const onMouseUp = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
      e.stopPropagation();
      e.preventDefault();
    }, [posX, posY]);
    React.useLayoutEffect(() => {
      adjustPosition(posX, posY);
    }, [entries, renderMode, leftTrail, rightTrail, posX, posY]);
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        ref: containerRef,
        className: clsx(
          wrapper
        ),
        style: posX !== void 0 && posY !== void 0 ? { left: `${posX}px`, top: `${posY}px` } : void 0,
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: header, onMouseDown, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "🔍" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: flexRow, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs(
                "select",
                {
                  value: renderMode,
                  onChange: (e) => updateOptions({ ...options, renderMode: e.target.value }),
                  className: select,
                  children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "inline", children: "같이" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "side-by-side", children: "나란히" }),
                    /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "stacked", children: "상하로" })
                  ]
                }
              ),
              /* @__PURE__ */ jsxRuntimeExports.jsx("button", { className: closeButton, onClick: hide, children: "✕" })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: trail, children: /* @__PURE__ */ jsxRuntimeExports.jsx(SectionTrail, { leftTrail, rightTrail }) }),
          tooLong ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: tooLongText, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: warningText, children: "욕심이 과하세요. 🤯" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: hintText, children: [
              MagnifierMaxTextLength,
              "글자까지만..."
            ] })
          ] }) : entries === null ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: loading, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { role: "img", "aria-label": "hourglass", className: noItalic, children: "⏳" }),
            " ",
            "아, 잠깐만요."
          ] }) }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: body, children: renderMode === "inline" ? renderInlineDiff(entries, leftText, rightText) : renderSplitDiff(
            entries,
            leftText,
            rightText,
            renderMode === "side-by-side" ? "row" : "col",
            options,
            updateOptions
          ) })
        ]
      }
    );
  }
  function renderInlineDiff(entries, leftText, rightText) {
    return entries.map((entry, i) => {
      let text = "";
      if ((entry.type === 0 || entry.type === 1) && entry.left) {
        text = leftText.slice(entry.left.start, entry.left.end);
      } else if (entry.type === 2 && entry.right) {
        text = rightText.slice(entry.right.start, entry.right.end);
      }
      const styleClass = entry.type === 0 ? equal : entry.type === 1 ? delete_ : insert;
      const displayText = entry.type === 0 ? text : text === "\n" ? "↵\n" : text === "	" ? "→" : text;
      return /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: styleClass, children: displayText }, i);
    });
  }
  function renderSplitDiff(entries, leftText, rightText, dir = "row", options, updateOptions) {
    function build(text, key, typeFlags) {
      const out = [];
      let buffer = [];
      let currentType = null;
      let spanIndex = 0;
      const flush = () => {
        if (buffer.length === 0) return;
        const className = currentType === 0 ? equal : currentType === 1 ? delete_ : insert;
        out.push(
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className, children: buffer.join("") }, ++spanIndex)
        );
        buffer = [];
      };
      for (const entry of entries) {
        if (entry.type !== 0 && !(entry.type & typeFlags)) continue;
        const seg = entry[key];
        if (!seg) continue;
        const segText = text.slice(seg.start, seg.end);
        const type = entry.type;
        if (currentType === null) currentType = type;
        if (type !== currentType) {
          flush();
          currentType = type;
        }
        buffer.push(
          entry.type !== 0 && segText === "\n" ? "↵\n" : entry.type !== 0 && segText === "	" ? "→" : segText
        );
      }
      flush();
      return out;
    }
    const leftLabelText = options.leftLabelText || DefaultLeftTextLabel;
    const rightLabelText = options.rightLabelText || DefaultRightTextLabel;
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "div",
      {
        className: clsx(
          container,
          dir === "col" ? col : row
        ),
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: textBlock, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              EditableLabel,
              {
                value: leftLabelText,
                onCommit: (val) => updateOptions({ ...options, leftLabelText: val })
              }
            ),
            " ",
            build(leftText, "left", 1)
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "div",
            {
              className: dir === "col" ? dividerRow : dividerCol
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: textBlock, children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(
              EditableLabel,
              {
                value: rightLabelText,
                onCommit: (val) => updateOptions({ ...options, rightLabelText: val })
              }
            ),
            " ",
            build(rightText, "right", 2)
          ] })
        ]
      }
    );
  }

  const DefaultLeftTextLabel = "L:";
  const DefaultRightTextLabel = "R:";
  const FACTORY_DEFAULT_OPTIONS = {
    renderMode: "stacked",
    enabled: true
  };
  const magnifierOptionsJsonAtom = atomWithStorage(
    "magnifierOptions",
    FACTORY_DEFAULT_OPTIONS
  );
  const magnifierOptionsAtom = atom((get) => {
    const stored = get(magnifierOptionsJsonAtom);
    return {
      ...FACTORY_DEFAULT_OPTIONS,
      ...stored
    };
  });
  atom((get) => {
    const options = get(magnifierOptionsAtom);
    return !!options.enabled;
  });
  atomWithStorage("magnifierLeftLabelText", "Left");
  atomWithStorage("magnifierRightLabelText", "Right");
  const MagnifierContext = React.createContext(void 0);
  function useMagnifier() {
    const ctx = React.useContext(MagnifierContext);
    if (!ctx) {
      throw new Error("useMagnifier must be used within a MagnifierProvider");
    }
    return ctx;
  }
  function MagnifierProvider({ children }) {
    const options = useAtomValue(magnifierOptionsAtom);
    const setOptions = useSetAtom(magnifierOptionsJsonAtom);
    const updateOptions = React.useCallback((newOptions) => {
      setOptions((prev) => {
        const mergedOptions = { ...prev, ...newOptions };
        localStorage.setItem("magnifierOptions", JSON.stringify(mergedOptions));
        return mergedOptions;
      });
    }, []);
    const [data, setData] = React.useState(null);
    const [visible, setVisible] = React.useState(false);
    const show = React.useCallback((data2) => {
      setData(data2);
      setVisible(true);
    }, []);
    const hide = React.useCallback(() => {
      setVisible(false);
    }, []);
    return /* @__PURE__ */ jsxRuntimeExports.jsxs(MagnifierContext.Provider, { value: { show, hide, updateOptions }, children: [
      children,
      data && visible && /* @__PURE__ */ jsxRuntimeExports.jsx(Magnifier, { ...data, options })
    ] });
  }

  const defaultOptions = {
    maxLength: void 0,
    // No limit by default
    newLineChar: "\n"
    // Default new line character
  };
  function extractTextFromRange(range, { maxLength, newLineChar } = defaultOptions) {
    const blockStack = [];
    let container = range.startContainer;
    let childIndex = range.startOffset;
    let endContainer = range.endContainer;
    let endOffset = range.endOffset;
    let hasVisibleContent = false;
    let length = 0;
    maxLength ??= 1e6;
    newLineChar ??= "\n";
    function normalizeText(str) {
      return str.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ");
    }
    const lines = [""];
    function append(str) {
      let cleaned = normalizeText(str);
      if (cleaned) {
        const curr = lines[lines.length - 1];
        if (curr === "") {
          cleaned = cleaned.trimStart();
        }
        lines[lines.length - 1] += cleaned;
        hasVisibleContent = true;
      }
    }
    function newline() {
      const curr = lines[lines.length - 1].trimEnd();
      lines[lines.length - 1] = curr;
      if (curr !== "") {
        length += curr.length;
        lines.push("");
      }
      return maxLength ? length > maxLength : false;
    }
    function finalize() {
      let trimmed = false;
      let result = lines.join(newLineChar).trimEnd();
      if (maxLength && result.length > maxLength) {
        result = result.slice(0, maxLength);
        trimmed = true;
      }
      return [result, trimmed];
    }
    if (container.nodeType === 3) {
      if (container === endContainer) {
        append(container.nodeValue.slice(childIndex, endOffset));
        return finalize();
      }
      append(container.nodeValue.slice(childIndex));
      const parent = container.parentNode;
      if (!parent) {
        return finalize();
      }
      childIndex = Array.prototype.indexOf.call(parent.childNodes, container) + 1;
      container = parent;
    }
    const indexStack = [];
    while (container) {
      if (container === endContainer) {
        if (childIndex >= endOffset) break;
      }
      const current = container.childNodes[childIndex];
      if (!current) {
        const prev = container;
        container = container.parentNode;
        if (!container) break;
        if (indexStack.length > 0) {
          childIndex = indexStack.pop();
        } else {
          childIndex = Array.prototype.indexOf.call(container.childNodes, prev);
        }
        childIndex++;
        if (BLOCK_ELEMENTS[prev.nodeName]) {
          if (hasVisibleContent) {
            if (newline()) break;
          }
          if (blockStack.length > 0) {
            ({ hasVisibleContent } = blockStack.pop());
          } else {
            hasVisibleContent = false;
          }
        }
        continue;
      }
      if (current.nodeType === 1) {
        if (BLOCK_ELEMENTS[current.nodeName]) {
          blockStack.push({ node: current, hasVisibleContent });
          hasVisibleContent = false;
        }
        if (current.nodeName === "BR") {
          if (newline()) break;
          hasVisibleContent = false;
        } else if (current.nodeName === "IMG") {
          append("🖼️");
        } else if (!VOID_ELEMENTS[current.nodeName]) {
          indexStack.push(childIndex);
          container = current;
          childIndex = 0;
          continue;
        }
      }
      if (current.nodeType === 3) {
        if (current === endContainer) {
          append(current.nodeValue.slice(0, endOffset));
          break;
        }
        append(current.nodeValue);
      }
      childIndex++;
    }
    return finalize();
  }

  var appLayout = 'App_appLayout__1bg21ve0';

  function getSectionTrail(sectionRoots, tokenIndex) {
    const deepest = findDeepestSectionHeading(sectionRoots, tokenIndex);
    if (!deepest) return [];
    const trail = buildSectionTrail(deepest);
    return trail;
  }
  function findDeepestSectionHeading(sectionRoots, tokenIndex) {
    let result = null;
    function search(node) {
      if (tokenIndex < node.startTokenIndex || tokenIndex >= node.endTokenIndex) return;
      result = node;
      let child = node.firstChild;
      while (child) {
        search(child);
        child = child.nextSibling;
      }
    }
    for (const root of sectionRoots) {
      search(root);
    }
    return result;
  }
  function buildSectionTrail(heading) {
    const trail = [];
    let current = heading;
    while (current) {
      trail.unshift(current);
      current = current.parent;
    }
    return trail;
  }

  const store = getDefaultStore();
  function App() {
    const { diffController, leftEditor, rightEditor } = useDiffEngineContext();
    useSetAtom(syncModeAtom);
    const magnifier = useMagnifier();
    const setEditorLayout = useSetAtom(editorPanelLayoutAtom);
    const [magnifierEnabled, setMagnifierEnabled] = useAtom(magnifierEnabledAtom);
    React.useEffect(() => {
      const unsubscribe = [];
      unsubscribe.push(diffController.onDiffInit((diffInitEvent) => {
      }));
      unsubscribe.push(diffController.onDiffStart((diffStartEvent) => {
      }));
      unsubscribe.push(diffController.onDiffDone((_diffContext) => {
      }));
      unsubscribe.push(diffController.onSyncModeChange((syncMode) => {
        store.set(syncModeAtom, syncMode);
      }));
      unsubscribe.push(diffController.onDiffVisibilityChanged((_changes) => {
        store.set(visibleDiffsAtom, diffController.getVisibleDiffs());
      }));
      unsubscribe.push(diffController.onHoveredDiffIndexChange((_diffIndex) => {
      }));
      unsubscribe.push(diffController.onTextSelection((selection) => {
        if (selection) {
          magnifier.show({
            leftText: selection.leftTokenSpan ? extractTextFromRange(selection.leftTokenRange, { maxLength: MagnifierMaxTextLength + 1 })[0] : "",
            rightText: selection.rightTokenSpan ? extractTextFromRange(selection.rightTokenRange, { maxLength: MagnifierMaxTextLength + 1 })[0] : "",
            leftTrail: selection.leftTokenSpan ? getSectionTrail(diffController.diffContext.leftSectionHeadings, selection.leftTokenSpan.start) : [],
            rightTrail: selection.rightTokenSpan ? getSectionTrail(diffController.diffContext.rightSectionHeadings, selection.rightTokenSpan.start) : []
          });
        }
      }));
      unsubscribe.push(store.sub(hoveredDiffIndexAtom, () => {
      }));
      setTimeout(() => {
        diffController.leftEditor.setContent(`
    <table>
  <tr>
    <td style="width: 200px;">
      <p>1. 개요</p>
      <p><br></p>
      <p>2. <span style="color:red;">작업 흐름</span></p>
      <p><br></p>
      <p>3. 역할과 권한</p>
      <p><br></p>
      <p>4. 프로세스 세부 단계</p>
      <p><br></p>
      <p>5. 문서화 및 보관</p>
      <p><br></p>
    </td>
    <td style="width: 800px;">
      <p>이 문서는 우리 회사의 전반적인 업무 흐름을 이해하는 데 도움을 주기 위한 가이드입니다.</p>
      <p>부서 간 업무 방식의 기준을 명확히 하여 협업을 효율적으로 돕는 것을 목표로 합니다.</p>
      <p>전체 프로세스는 구조적으로 짜여져 있으며, 각 단계마다 구체적인 역할과 책임이 부여되어 있습니다.</p>
      <p>이를 통해 오류를 줄이고 협업의 시너지를 높일 수 있습니다.</p>
      <p>내용은 실무자가 바로 이해하고 적용할 수 있도록 정리되었으며, 업무 수행 중 참고 자료로 활용 가능합니다.</p>
      <p>또한 실무상 마주할 수 있는 다양한 이슈에 대한 대응책도 포함되어 있어 업무에 실질적인 도움이 됩니다.</p>
      <p><br></p>
      <p>1) 작업 시작 전, 필요한 자료와 도구를 준비하고 체크리스트를 확인합니다.</p>
      <p>2) 정해진 단계별 지침에 따라 업무를 수행하며, 문제 발생 시 즉각적으로 대응합니다.</p>
      <p>3) 중간 결과는 일정 주기마다 검토하여 품질을 유지합니다.</p>
      <p>4) 최종 산출물은 상급자의 확인을 거쳐 공식 문서로 정리합니다.</p>
      <p>5) 추가 조치가 필요한 경우, 관련 부서와 협력하여 빠르게 처리합니다.</p>
      <p>6) 전체 진행 과정은 기록으로 남겨 개선 및 보고에 활용합니다.</p>
      <p><br></p>
      <p>가. 모든 부서는 고유의 책임과 권한을 갖고 있습니다.</p>
      <p>나. 발생하는 문제는 해당 책임 부서에서 신속히 처리합니다.</p>
      <p>다. 업무 권한은 회사 방침 및 관련 규정에 따라 부여되며, 반드시 이를 준수해야 합니다.</p>
      <p>라. 담당자는 자신에게 부여된 권한 범위 내에서만 의사결정을 할 수 있습니다.</p>
      <p><br></p>
      <p>(1) 사전 준비</p>
      <p>- 업무 범위 설정 및 자원 점검</p>
      <p>- 관련 법규 및 사내 정책 검토</p>
      <p>(2) 실행</p>
      <p>- 계획에 따라 작업 수행</p>
      <p>- 이슈 발생 시 실시간 대응</p>
      <p>(3) 종료</p>
      <p>- 결과 검토 및 문서화</p>
      <p>- 산출물 보관 및 후속 관리</p>
      <p><br></p>
      <p>가. 모든 업무 기록은 정해진 기준에 따라 정리되고 관리되어야 합니다.</p>
      <p>나. 문서의 생성에서 폐기까지 전 과정은 절차에 맞춰 처리합니다.</p>
      <p>다. 디지털과 인쇄 문서 모두 접근 제한과 보안을 철저히 관리합니다.</p>
      <p>라. 버전 관리를 통해 문서가 항상 최신 상태를 유지하도록 합니다.</p>
    </td>
  </tr>
</table>
`);
        diffController.rightEditor.setContent(`
       <table> <tr> <td><p>1. 개요</p></td> <td> <p>이 문서는 우리 회사의 전반적인 업무 흐르믈 이해하는 데 도움을 주기 위한 가이드입니다. 부서 간 업무 방식의 기준을 명확히 하여 협업을 효율적으로 돕는 것을 목표로 합니다.</p> <p>전체 프로세스는 구조적으로 짜여져 있으며, 각 단계마다 구체적인 역할과 책임이 부여되어 있습니다. 이를 통해 오류를 줄이고 협업의 시너지를 높일 수 있습니다.</p> <p>내용은 실무자가 바로 이해하고 적용할 수 있도록 정리되었으며, 업무 수행 중 참고 자료로 활용 가능합니다.</p> <p>또한 실무상 마주할 수 있는 다양한 이슈에 대한 대응책도 포함되어 있어 업무에 실질적인 도움이 됩니다.</p> </td> </tr> <tr> <td><p>2. 작업 흐름</p></td> <td> <p>1) 작업 시작 전, 필요한 자료와 도구를 준비하고 체크리스트를 확인합니다.</p> <p>2) 정해진 단계별 지침에 따라 업무를 수행하며, 문제 발생 시 즉각적으로 대응합니다.</p> <p>3) 중간 결과는 일정 주기마다 검토하여 품질을 유지합니다.</p> <p>4) 최종 산출물은 상급자의 확인을 거쳐 공식 문서로 정리합니다.</p> <p>5) 추가 조치가 필요한 경우, 관련 부서와 협력하여 빠르게 처리합니다.</p> <p>6) 전체 진행 과정은 기록으로 남겨 개선 및 보고에 활용합니다.</p> </td> </tr> <tr> <td><p>3. 역할과 권한</p></td> <td> <p>가. 모든 부서는 고유의 책임과 권한을 갖고 있습니다.</p> <p>나. 발생하는 문제는 해당 책임 부서에서 신속히 처리합니다.</p> <p>다. 업무 권한은 회사 방침 및 관련 규정에 따라 부여되며, 반드시 이를 준수해야 합니다.</p> <p>라. 담당자는 자신에게 부여된 권한 범위 내에서만 의사결정을 할 수 있습니다.</p> </td> </tr> <tr> <td><p>4. 프로세스 세부 단계</p></td> <td> <p>(1) 사전 준비</p> <p>- 업무 범위 설정 및 자원 점검</p> <p>- 관련 법규 및 사내 정책 검토</p> <p>(2) 실행</p> <p>- 계획에 따라 작업 수행</p> <p>- 이슈 발생 시 실시간 대응</p> <p>(3) 종료</p> <p>- 결과 검토 및 문서화</p> <p>- 산출물 보관 및 후속 관리</p> </td> </tr> <tr> <td><p>5. 문서화 및 보관</p></td> <td> <p>가. 모든 업무 기록은 정해진 기준에 따라 정리되고 관리되어야 합니다.</p> <p>나. 문서의 생성에서 폐기까지 전 과정은 절차에 맞춰 처리합니다.</p> <p>다. 디지털과 인쇄 문서 모두 접근 제한과 보안을 철저히 관리합니다.</p> <p>라. 버전 관리를 통해 문서가 항상 최신 상태를 유지하도록 합니다.</p> </td> </tr> </table>
`);
      }, 0);
      return () => {
        for (const off of unsubscribe) off();
      };
    }, []);
    React.useEffect(() => {
      if (magnifierEnabled) {
        const off = diffController.onTextSelection((selection) => {
          if (!selection) {
            return;
          }
          const { leftTokenSpan: leftSpan, rightTokenSpan: rightSpan } = selection;
          const diffContext = diffController.diffContext;
          const leftTrail = leftSpan ? getSectionTrail(diffContext.leftSectionHeadings, leftSpan.start) : [];
          const rightTrail = rightSpan ? getSectionTrail(diffContext.rightSectionHeadings, rightSpan.start) : [];
          const [leftText] = extractTextFromRange(selection.leftTokenRange, { maxLength: MagnifierMaxTextLength + 1 });
          const [rightText] = extractTextFromRange(selection.rightTokenRange, { maxLength: MagnifierMaxTextLength + 1 });
          magnifier.show({
            leftText,
            rightText,
            leftTrail,
            rightTrail
          });
        });
        return off;
      } else {
        magnifier.hide();
      }
    }, [magnifierEnabled]);
    React.useEffect(() => {
      const handleKeyDown = (e) => {
        if (e.key === "F2") {
          e.preventDefault();
          diffController.syncMode = !diffController.syncMode;
        }
        if (e.key === "F3") {
          e.preventDefault();
          setMagnifierEnabled((current) => !current);
        }
        if (e.key === "F10") {
          e.preventDefault();
          setEditorLayout((current) => current === "horizontal" ? "vertical" : "horizontal");
          diffController.alignEditors();
          diffController.renderer.invalidateAll();
        }
        if (e.ctrlKey && (e.key === "1" || e.key === "2")) {
          e.preventDefault();
          const editor = e.key === "1" ? leftEditor : rightEditor;
          editor.pasteBomb();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }, []);
    return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: clsx(appLayout), children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(EditorPanel, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(AppSidebar, {})
    ] }) });
  }

  const leftEditor = new Editor("left");
  const rightEditor = new Editor("right");
  const renderer = new Renderer(leftEditor, rightEditor);
  const diffController = new DiffController(leftEditor, rightEditor, renderer);
  client.createRoot(document.getElementById("root")).render(
    /* @__PURE__ */ jsxRuntimeExports.jsx(React.StrictMode, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(DiffEngineProvider, { value: { diffController, leftEditor, rightEditor, renderer }, children: /* @__PURE__ */ jsxRuntimeExports.jsx(MagnifierProvider, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(App, {}) }) }) })
  );

})(ReactDOM, React);
