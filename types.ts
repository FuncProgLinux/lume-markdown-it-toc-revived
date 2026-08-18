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
     * @default: `${toc}`, `[toc]`, `[[toc]]`, `[[_toc_]]`.
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

    // Accessible names, too lazy to document them all.
    // TODO(FuncProgLinux): Document these!
    ariaLabel?: string;
    listClass?: string;
    itemClass?: string;
    linkClass?: string;

    /**
     * Builds the link label. The return value is inserted **raw**: escape it
     * yourself with the provided helper or you own the XSS, your choice, hacker.
     */
    format?: (text: string, escape: (s: string) => string) => string;
}

// HACK:
// Lazy asf subset of markdown-it tokens. It should kind of be compatible
// with the API made by trial and error.

/**
 * @internal
 * NOT MEANT TO BE USED OUTSIDE THE PLUGIN SOURCE!
 * TODO(FuncProgLinux): Document internal API!
 */
export interface Token {
    type: string;
    tag: string;
    markup: string;
    map: [number, number] | null;
    children: Token[] | null;
    content: string;
    attrGet?(name: string): string | null;
}

/**
 * @internal
 * NOT MEANT TO BE USED OUTSIDE THE PLUGIN SOURCE!
 * TODO(FuncProgLinux): Document internal API!
 */
export interface StateBlock {
    src: string;
    bMarks: number[];
    eMarks: number[];
    tShift: number[];
    sCount: number[];
    blkIndent: number;
    line: number;
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
