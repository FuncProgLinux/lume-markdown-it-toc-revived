/**
 * Represents a node of the generated table of contents.
 */
export interface TocNode {
    /**
     * Used for the heading levels, should be limited from 1 to 6
     * @type {number}
     */
    level: number;

    /**
     * Plain and unescaped heading text.
     * @type {string}
     */
    text: string;

    /**
     * Fragment target, without the leading hash '#'
     * @type {string}
     */
    slug: string;

    /**
     * Self-contained nodes
     * @type {TocNode[]}
     */
    children: TocNode[];
}

export interface TocOptions {
    /**
     * Anchored regexp tested against the trimmed line.
     * Defaults to matching `${toc}`, `[toc]`, `[[toc]]`, `[[_toc_]]`.
     * @type {RegExp | undefined}
     */
    placeholder?: RegExp | undefined;

    /**
     * Fallback slugifier, only used when the heading has no `id` attribute yet.
     */
    slugify?: ((text: string) => string) | undefined;

    /**
     * Minimum level (number) or explicit set of levels (array).
     * @default 1
     * @type {number | readonly number[] | undefined}
     */
    level?: number | readonly number[] | undefined;

    /**
     * The list type to render, either ordered or unordered list
     *
     * @default "ol"
     * @type {"ol" | "ul" | undefined}
     */
    listType?: "ol" | "ul" | undefined;

    /**
     * Tag to use for the Table of Contents container element
     * should the value be missing, the HTML tag used will be
     * a `<nav></nav>` tag.
     *
     * @default "nav"
     * @type {string | undefined}
     */
    containerTag?: string | undefined;

    /**
     * The HTML Class attribute for the ToC container element.
     * @default "table-of-contents"
     * Pass `""` to omit.
     * @type {string | undefined}
     */
    containerClass?: string | undefined;

    /**
     * The HTML ID attribute for the ToC container element.
     * @type {string | undefined}
     */
    containerId?: string | undefined;

    /**
     * `aria-label` attribute for the container element, for assistive tech.
     * This is omitted when unset.
     * @type {string | undefined}
     */
    ariaLabel?: string;

    /**
     * Class for the `<ol>` / `<ul>` list HTML element.
     * This is omitted when unset.
     * @type {string | undefined}
     */
    listClass?: string;

    /**
     * Class for every `<li>` element.
     * This is omitted when unset.
     * @type {string | undefined}
     */
    itemClass?: string;

    /**
     * Class for every `<a>` element.
     * This is omitted when unset.
     * @type {string | undefined}
     */
    linkClass?: string;

    /**
     * Builds the link label. The return value is inserted **raw**: escape it
     * yourself with the provided helper or you own the XSS, your choice, hacker
     *
     * @example
     * ```ts
     * format: (text, escape) => escape(text) + " <em>(top)</em>"
     * ```
     */
    format?: (text: string, escape: (s: string) => string) => string;
}

/**
 * Minimal subset of the markdown-it `Token` surface this plugin reads.
 */
export interface Token {
    /**
     * Token type, e.g: `"heading_open"`, `"inline"`, `"text"`.
     * @type {string}
     */
    type: string;

    /**
     * HTML tag, e.g `"h2"` for heading tokens.
     * @type {string}
     */
    tag: string;

    /**
     * Original source markup, placeholder line for `toc` tokens
     * @type {string}
     */
    markup: string;

    /**
     * Line range in the source this particular token covers
     * @type {[number, number] | null}
     */
    map: [number, number] | null;

    /**
     * Nested inline tokens, set on `"inline"` tokens (duh)
     * @type {Token[] | null}
     */
    children: Token[] | null;

    /**
     * Raw text content for leaf tokens
     * @type {string}
     */
    content: string;

    /**
     * Read an attribute an earlier plugin set, e.g: `id`.
     * @param {string} name
     */
    attrGet?(name: string): string | number | null;
}

/**
 * Minimal subset of the markdown-it block `State` surface this plugin reads.
 */
export interface StateBlock {
    /**
     * Full source text
     * @type {string}
     */
    src: string;

    /**
     * Line start offsets in `src`
     * @type {number[]}
     */
    bMarks: number[];

    /**
     * Line end offsets in `src`
     * @type {number[]}
     */
    eMarks: number[];

    /**
     * Leading whitespace (tabs expanded) per line
     * @type {number[]}
     */
    tShift: number[];

    /**
     * Indent counts per line
     * @type {number[]}
     */
    sCount: number[];

    /**
     * Block indent
     * @type {number}
     */
    blkIndent: number;

    /**
     * Current line index, write to consume lines
     * @type {number}
     */
    line: number;

    /**
     * Emit a token into the stream
     * @param {string} type
     * @param {string} tag
     * @param {number} nesting
     */
    push(type: string, tag: string, nesting: number): Token;
}

/** Minimal shape of the markdown-it instance this plugin touches. */
export interface MarkdownItLike {
    block: {
        ruler: {
            before(
                beforeName: string,
                ruleName: string,
                fn: (
                    state: StateBlock,
                    startLine: number,
                    endLine: number,
                    silent: boolean,
                ) => boolean,
                options?: { alt?: string[] },
            ): void;
        };
    };
    renderer: {
        rules: Record<string, unknown>;
    };
}

/**
 * Signature accepted by `md.use()` and by Lume's `markdown.plugins`.
 */
export type TocPlugin = (md: MarkdownItLike) => void;
