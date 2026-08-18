import { escape } from "@std/html";
import {
    MarkdownItLike,
    StateBlock,
    TocNode,
    TocOptions,
    TocPlugin,
    Token,
} from "./types.ts";

const DEFAULT_PLACEHOLDER: RegExp = /^(\$\{toc\}|\[\[?_?toc_?\]?\])$/i;

/** Fallback slugifier. Preserves Unicode via percent-encoding. */
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

const headingText = (inline: Token): string => {
    let out: string = "";
    for (const child of inline.children ?? []) {
        if (child.type === "text" || child.type === "code_inline") {
            out += child.content;
        }
    }
    // The original markdown-it-toc-done-right returns this with a leading space
    // This should fix it without introducing regressions.
    return out.trim();
};

/** Walks the token stream and builds the nested heading tree. */
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
        let slug: string | null = token.attrGet?.("id") ?? null;
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

const attr = (name: string, value: string | undefined): string => {
    return value ? ` ${name}="${escape(value)}"` : "";
};

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
 * Creates the markdown-it plugin. The tree is built at render time, so the
 * plugin works regardless of registration order relative to markdown-it-anchor.
 *
 * Also writes the tree to `env.toc` when `env` is an object.
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
                if (state.sCount[startLine] - state.blkIndent >= 4) {
                    return false;
                }
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
