# markdown-it-toc-revived

[![JSR](https://jsr.io/badges/@funcproglinux/markdown-it-toc-revived)](https://jsr.io/@funcproglinux/markdown-it-toc-revived)

Table of Contents plugin reworked using the Deno stack to mimic the same plugin
published [here](https://github.com/nagaozen/markdown-it-toc-done-right). Which
I need for [my Lume site](https://urutau-ltd.org/).

> [!IMPORTANT]
> **ROBOT TRANSPARENCY NOTICE**: A robot (DeepSeek V4 Pro) was used to generate
> Unit tests, the bot didn't write those, it suggested 15-line patches that were
> curated by me. This same methodology was used to generate the type
> compatibilty. All "AI" code was hand-reviewed and corrected.

## Usage

**TL;DR** Don't. I made this for my own website because the
[Lume TOC](https://lume.land/plugins/toc/) was beyond unusable for me and I'd
rather maintain a fork to keep doing things my way.

Also tests are Deno runtime dependent and the build system doesn't use deno
tasks but `maak` instead. You'll need either `nix` or `guix` for that.

### I don't care, I still want to use it

Install it via JSR with:

```bash
deno install jsr:@funcproglinux/markdown-it-toc-revived
```

Don't expect many updates through there as they have relied on **FlareSlop** to
enforce proprietary web malware:

![cloudflare-can-goto-hell](./.repo-assets/cloudflare-proprietary-garbage.png)

Usage in Markdown:

```md
[[toc]]

## First

### Nested
```

Placeholders: `${toc}`, `[toc]`, `[[toc]]`, `[[_toc_]]` (case-insensitive),
alone on a line.

Lume 3.3.1 retyped `markdown.plugins` from `unknown[]` to
`(MarkdownItPlugin | [MarkdownItPlugin, unknown[]])[]`, which breaks the
`[plugin, {options}]` tuple in two separate ways:

1. `MarkdownItPlugin` defaults to `...params: unknown[]`, so no plugin with
   typed options is assignable (`unknown` is not assignable to
   `AnchorOptions | undefined`). Parameterizing the generic doesn't help either.

2. The type says the second tuple element is a params array, but the runtime is
   `engine.use(...plugin)`, i.e. that element is passed as a _single_ argument.
   Obey the type and write `[mdAnchor, [opts]]` and your options are silently
   dropped.

This plugin is a factory, so it drops straight into `plugins`. For third-party
plugins with options, use Lume's `addMarkdownItPlugin` hook instead of a tuple:

```ts
import lume from "lume/mod.ts";
import mdAnchor from "markdown-it-anchor";
import { toc } from "@funcproglinux/markdown-it-toc-revived";

const site = lume({ src: "./src", dest: "./output" }, {
    markdown: {
        options: { html: true },
        plugins: [
            toc({
                level: [2, 3, 4, 5, 6],
                listType: "ul",
                containerClass: "table-of-contents",
                listClass: "nested-list",
            }),
        ],
    },
});

site.hooks.addMarkdownItPlugin(mdAnchor, {
    permalink: mdAnchor.permalink.linkInsideHeader({
        placement: "before",
        symbol: "§",
        class: "text-decoration-none",
    }),
});

export default site;
```

`markdown-it-attrs` and `markdown-it-deflist` are already installed by Lume by
default, so don't pass them again unless you set `useDefaultPlugins: false`.

Order doesn't really matter as the tree gets built at render time, so whatever
`id`s `markdown-it-anchor` set are already there and it just uses those.

## Programatic API

JSDocs are your friend.

## Implementation pitfalls

1. The tree is rebuilt per placeholder. Which should be more than enough for
   sites with a single ToC. I've yet to see a legitimate use case for more than
   one, but needless to say it's obvious what would happen given the condition I
   just mentioned.

2. It only reads `text` and `code_inline`. Alt text and raw `html_inline` in a
   heading will be dropped.

3. Reads the text **after** core rules, so `typographer` already mangled your
   quotes.

4. Without `markdown-it-anchor`, duplicate headings get `-1`, `-2` suffixes
   computed here; nothing emits matching `id`s, so those links go nowhere. Use
   an anchor plugin or write your own.

5. Inline options for `$<toc{...}>` are removed on purpose. Don't expect those.

6. Lume runs `engine.disable("code")`, so a placeholder indented by 4 spaces is
   not a code block there: the rule bails on the indent guard and the line falls
   through to `paragraph`, rendering `[[toc]]` literally instead of `<pre>`.

## Test

```sh
deno check && deno lint && deno test
```

## License

Even though similar logic is shared, mostly for exposed API that will be used in
a Lume site this is written from scratch. If you still want to use it, that's
AGPLv3.0 or later for y'all.

This is an independent implementation based on the API exposed by
`markdown-it-toc-done-right` under the MIT License, © Fabio Zendhi Nagao.
