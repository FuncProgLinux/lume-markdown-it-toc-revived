import { escape } from "@std/html";
import {
    MarkdownItLike,
    StateBlock,
    TocNode,
    TocOptions,
    TocPlugin,
    Token,
} from "./types.ts";

/**
 * @internal
 * Anchored placeholder pattern, tested against the whole trimmed line.
 * Should match `${toc}`, `[toc]`, `[[toc]]` and `[[_toc_]]` case insensitive.
 * Same list as {@link TocOptions.placeholder}
 */
const DEFAULT_PLACEHOLDER: RegExp = /^(\$\{toc\}|\[\[?_?toc_?\]?\])$/i;

/**
 * Fallback slugifier. Also exported so custom `slugify` options can wrap it.
 * @param {string} text - Heading text
 * @returns {string} URL safe fragment without leading hashes `#`
 *
 * @example
 * ```ts
 * defaultSlugify("    Hello   World    "); // Returns: "hello-world"
 * defaultSlugify("Ñandú");             // "%C3%B1and%C3%BA"
 * ```
 */
export const defaultSlugify = (text: string): string => {
    return encodeURIComponent(
        text.trim().toLowerCase().split(/\s+/).join("-").replace(
            /^-+|-+$/g,
            "",
        ),
    );
};
interface Resolved {
    placeholder: RegExp;
    slugify: (text: string) => string;
    isSelected: (level: number) => boolean;
    listType: string;
    containerTag: string;
    containerClass?: string | undefined;
    containerId?: string | undefined;
    ariaLabel?: string | undefined;
    listClass?: string | undefined;
    itemClass?: string | undefined;
    linkClass?: string | undefined;
    format?: (text: string, escape: (s: string) => string) => string;
}

/**
 * @internal
 * Applies defaults and validates. Throws on invalid input, so `toc()` fails
 * fast at plugin creation.
 *
 * @param {TocOptions} o - Plugin options. By default it's an empty object.
 * @returns {Resolved} Options with all defaults applied.
 * @throws {TypeError} if `level` is neither `number` nor `number[]`, or if
 * `listType` is not `"ol"` or `"ul"`
 */
const resolve = (o: TocOptions = {}): Resolved => {
    const level: number | readonly number[] = o.level ?? 1;
    if (typeof level !== "number" && !Array.isArray(level)) {
        throw new TypeError(
            "toc: `level` must be a number or an array of numbers",
        );
    }
    if (
        o.listType !== undefined && o.listType !== "ol" && o.listType !== "ul"
    ) {
        throw new TypeError('toc: `listType` must be "ol" or "ul"');
    }
    const levels: Set<number> | null = Array.isArray(level)
        ? new Set(level)
        : null;
    return {
        placeholder: o.placeholder ?? DEFAULT_PLACEHOLDER,
        slugify: (text: string): string =>
            o.slugify?.(text) ?? defaultSlugify(text),
        isSelected: levels
            ? (l): boolean => levels.has(l)
            : (l): boolean => l >= (level as number),
        listType: o.listType ?? "ol",
        containerTag: o.containerTag ?? "nav",
        containerClass: o.containerClass ?? "table-of-contents",
        containerId: o.containerId,
        ariaLabel: o.ariaLabel,
        listClass: o.listClass,
        itemClass: o.itemClass,
        linkClass: o.linkClass,
        format: o.format,
    };
};

/**
 * @internal
 * Extracts visible text from a heading's inline children. Only `text` and
 * `code_inline` survive, everything else gets ignored. This is internal API
 * behaviour not exposed to the user, it's documented at the README as a
 * pitfall.
 *
 * @param inline
 * @returns
 */
const headingText = (inline: Token): string => {
    let out: string = "";
    for (const child of inline.children ?? []) {
        if (child.type === "text" || child.type === "code_inline") {
            out += child.content;
        }
    }

    return out.trim();
};

/**
 * Walks the block token stream and builds a nested heading tree, this is used
 * at render time so anchor plugins may run in any registration order.
 *
 * This assumes `markdown-it-anchor` and `markdown-it-attrs` may already
 * have set an `id` HTML attribute, such attribute is reused verbatim so
 * existing links don't break.
 *
 * Duplicated headings only get `-1`, `-2` suffixes when this plugin generates
 * the slug itself. This is also documented as a pitfall in the README.
 *
 * @param {Token[]} tokens - Render time token stream (all block tokens)
 * @param {Resolved} o - Resolved options from `resolve()` internal
 * @returns {TocNode[]} Root nodes, one per each top level selected heading
 *
 * @see {@link https://github.com/nagaozen/markdown-it-toc-done-right} for the
 * original API this mimics.
 */
export const buildTree = (tokens: Token[], o: Resolved): TocNode[] => {
    const seen: Map<string, number> = new Map<string, number>();
    const roots: TocNode[] = [];
    const stack: TocNode[] = [];

    for (let i = 0; i < tokens.length; i++) {
        const token: Token = tokens[i];
        if (token.type !== "heading_open") continue;

        const level: number = Number.parseInt(token.tag.slice(1), 10);
        if (!Number.isFinite(level) || !o.isSelected(level)) continue;

        const inline: Token = tokens[i + 1];
        if (!inline || inline.type !== "inline") continue;

        const text: string = headingText(inline);

        // Reuse the id markdown-it-anchor (or markdown-it-attrs) already produced,
        // otherwise links break on duplicate headings.
        let slug: string | null = token.attrGet?.("id")?.toString() ?? null;
        if (!slug) {
            slug = o.slugify(text);
            const n: number = seen.get(slug) ?? 0;
            seen.set(slug, n + 1);
            if (n > 0) slug = `${slug}-${n}`;
        }

        const node: TocNode = { level, text, slug, children: [] };
        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
            stack.pop();
        }
        if (stack.length === 0) roots.push(node);
        else stack[stack.length - 1].children.push(node);
        stack.push(node);
    }

    return roots;
};

/**
 * @internal
 * TODO(FuncProgLinux): Document this
 */
const attr = (name: string, value: string | undefined): string => {
    return value ? ` ${name}="${escape(value)}"` : "";
};

/**
 * @internal
 * TODO(FuncProgLinux): Document this
 */
const renderList = (nodes: TocNode[], o: Resolved): string => {
    if (nodes.length === 0) return "";
    let out: string = `<${o.listType}${attr("class", o.listClass)}>`;
    for (const node of nodes) {
        const label = o.format
            ? o.format(node.text, escape)
            : escape(node.text);
        out += `<li${attr("class", o.itemClass)}>` +
            `<a${attr("class", o.linkClass)} href="#${
                escape(node.slug)
            }">${label}</a>` +
            renderList(node.children, o) +
            `</li>`;
    }
    return out + `</${o.listType}>`;
};

/**
 * Creates the `markdown-it` plugin, it's accepted by `md.use()` and by Lume's
 * `markdown.plugins` array since v3.3.1. It's a factory which changes the way
 * it should be used.
 *
 * This factory is idempotent, it should be able to tolerate a second `use()`
 * without installing duplicated rules. The tree is rebuilt per placeholder at
 * render time so registration order relative to `markdown-it-anchor` shouldn't
 * matter.
 *
 * When `env` is an object, the tree is also written to `env.toc`
 * as `TocNode[]`
 *
 * @param {TocOptions} options - Plugin options. Invalid values throw errors
 * @returns {TocPlugin} Plugin for `md.use()` and Lume v3.3.1
 * @throws {TypeError} See `resolve()` at the internal API.
 *
 * @example
 * ```ts ignore
 * // Markdown: `[[toc]]` alone on a line.
 * md.use(toc({ level: [2, 3], listType: "ul" }));
 * ```
 *
 * @example
 * ```ts ignore
 * const env = {};
 * md.renderer.render(md.parse(src, env), {}, env);
 * env.toc; // TocNode[]
 * ```
 */
export const toc = (options: TocOptions = {}): TocPlugin => {
    const o: Resolved = resolve(options);

    return function (md: MarkdownItLike): void {
        if (md.renderer.rules.toc) return; // idempotent: tolerate double .use()

        md.block.ruler.before(
            "heading",
            "toc",
            (
                state: StateBlock,
                startLine: number,
                _endLine: number,
                silent: boolean,
            ): boolean => {
                const pos: number = state.bMarks[startLine] +
                    state.tShift[startLine];
                const line: string = state.src.slice(
                    pos,
                    state.eMarks[startLine],
                )
                    .trim();
                if (!o.placeholder.test(line)) return false;
                if (silent) return true;

                state.line = startLine + 1;
                const token: Token = state.push("toc", o.containerTag, 0);
                token.markup = line;
                token.map = [startLine, state.line];
                return true;
            },
            { alt: ["paragraph", "reference", "blockquote"] },
        );

        md.renderer.rules.toc = (
            tokens: Token[],
            _idx: number,
            _options: unknown,
            env: unknown,
        ): string => {
            const nodes: TocNode[] = buildTree(tokens, o);
            if (env && typeof env === "object") {
                (env as { toc?: TocNode[] }).toc = nodes;
            }
            return `<${o.containerTag}${attr("id", o.containerId)}` +
                `${attr("class", o.containerClass)}${
                    attr("aria-label", o.ariaLabel)
                }>` +
                `${renderList(nodes, o)}</${o.containerTag}>\n`;
        };
    };
};

export default toc;
