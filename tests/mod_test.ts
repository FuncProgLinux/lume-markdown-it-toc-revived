import {
    assert,
    assertEquals,
    assertMatch,
    assertStringIncludes,
    assertThrows,
} from "@std/assert";
import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import { defaultSlugify, toc } from "../mod.ts";
import { TocNode, TocOptions } from "../types.ts";

const mk = (o?: TocOptions): MarkdownIt =>
    new MarkdownIt({ html: true }).use(toc(o));

Deno.test("placeholder variants", () => {
    for (const p of ["${toc}", "[[toc]]", "[toc]", "[[_toc_]]", "[_TOC_]"]) {
        assertMatch(
            mk().render(`${p}\n\n# A\n`),
            /^<nav class="table-of-contents"><ol>/,
        );
    }
});

Deno.test("nesting h1>h2>h3 and back", () => {
    const html: string = mk().render(
        "[[toc]]\n\n# A\n\n## B\n\n### C\n\n## D\n\n# E\n",
    );
    assertEquals(
        html.split("</nav>")[0] + "</nav>",
        '<nav class="table-of-contents"><ol><li><a href="#a">A</a><ol><li><a href="#b">B</a>' +
            '<ol><li><a href="#c">C</a></li></ol></li><li><a href="#d">D</a></li></ol></li>' +
            '<li><a href="#e">E</a></li></ol></nav>',
    );
});

Deno.test("skipped level h1>h3 nests instead of crashing", () => {
    assertMatch(
        mk().render("[[toc]]\n\n# A\n\n### C\n"),
        /<li><a href="#a">A<\/a><ol><li><a href="#c">C<\/a><\/li><\/ol><\/li>/,
    );
});

Deno.test("level array selects a subset and promotes roots", () => {
    assertMatch(
        mk({ level: [2, 3], listType: "ul" }).render(
            "[[toc]]\n\n# A\n\n## B\n\n### C\n",
        ),
        /^<nav class="table-of-contents"><ul><li><a href="#b">B<\/a><ul><li><a href="#c">C<\/a>/,
    );
});

Deno.test("level number is a minimum", () => {
    const html: string = mk({ level: 2 }).render("[[toc]]\n\n# A\n\n## B\n");
    assert(!html.includes('href="#a"'));
    assert(html.includes('href="#b"'));
});

Deno.test("reuses markdown-it-anchor ids even when registered first", () => {
    const md: MarkdownIt = new MarkdownIt()
        .use(toc())
        .use(anchor, { slugify: (s: string) => "x-" + s.toLowerCase() });
    const html = md.render("[[toc]]\n\n# Hello\n");
    assertMatch(html, /href="#x-hello"/);
    assertMatch(html, /<h1 id="x-hello"/);
});

Deno.test("duplicate headings: hrefs match anchor ids", () => {
    const md: MarkdownIt = new MarkdownIt().use(toc()).use(
        anchor,
    );
    const html: string = md.render("[[toc]]\n\n# A\n\n# A\n");
    const ids = [...html.matchAll(/<h1 id="([^"]+)"/g)].map((m) => m[1]);
    const hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    assertEquals(hrefs, ids);
});

Deno.test("duplicate headings are disambiguated without anchor", () => {
    assertMatch(
        mk().render("[[toc]]\n\n# A\n\n# A\n"),
        /href="#a".*href="#a-1"/s,
    );
});

Deno.test("heading markup is escaped", () => {
    const nav: string =
        mk().render('[[toc]]\n\n# <img src=x onerror="alert(1)">hi\n').split(
            "</nav>",
        )[0];
    assert(!nav.includes("<img"), nav);
});

Deno.test("container id and classes are escaped", () => {
    const html: string = mk({ containerId: '" onload="a', listClass: "<b>" })
        .render(
            "[[toc]]\n\n# A\n",
        );
    assertMatch(html, /id="&quot; onload=&quot;a"/);
    assertMatch(html, /<ol class="&lt;b&gt;">/);
});

Deno.test("unicode and code_inline in headings", () => {
    const heading: string = "T\u00edtulo `c\u00f3digo` \u65e5\u672c\u8a9e";
    const label: string = "T\u00edtulo c\u00f3digo \u65e5\u672c\u8a9e";
    const html: string = mk().render(`[[toc]]\n\n# ${heading}\n`);
    assertMatch(
        html,
        /href="#t%C3%ADtulo-c%C3%B3digo-%E6%97%A5%E6%9C%AC%E8%AA%9E"/,
    );
    assertStringIncludes(html, `>${label}<`);
});

Deno.test("placeholder inside a fence is not parsed", () => {
    assert(!mk().render("```\n[[toc]]\n```\n\n# A\n").includes("<nav"));
});

Deno.test("placeholder indented 4 spaces is a code block", () => {
    assert(!mk().render("    [[toc]]\n\n# A\n").includes("<nav"));
});

Deno.test("no headings renders an empty container", () => {
    assertEquals(
        mk().render("[[toc]]\n").trim(),
        '<nav class="table-of-contents"></nav>',
    );
});

Deno.test("no placeholder renders nothing", () => {
    assert(!mk().render("# A\n").includes("<nav"));
});

Deno.test("two placeholders both render", () => {
    assertEquals(
        mk().render("[[toc]]\n\n# A\n\n[[toc]]\n").match(/<nav/g)?.length,
        2,
    );
});

Deno.test("reentrancy: parse A, parse B, render A", () => {
    const md: MarkdownIt = mk();
    const a = md.parse("[[toc]]\n\n# AAA\n", {});
    md.parse("[[toc]]\n\n# BBB\n", {});
    assertMatch(md.renderer.render(a, md.options, {}), /AAA/);
});

Deno.test("env.toc is exposed", () => {
    const env: { toc?: TocNode[] } = {};
    mk().render("[[toc]]\n\n# A\n\n## B\n", env);
    assertEquals(env.toc?.[0].children[0].text, "B");
});

Deno.test("double use() does not duplicate output", () => {
    const md = new MarkdownIt().use(toc()).use(toc());
    assertEquals(md.render("[[toc]]\n\n# A\n").match(/<nav/g)?.length, 1);
});

Deno.test("format receives the escaper", () => {
    assertMatch(
        mk({ format: (s, e) => `<em>${e(s)}</em>` }).render(
            "[[toc]]\n\n# A&B\n",
        ),
        /<em>A&amp;B<\/em>/,
    );
});

Deno.test("placeholder inside blockquote", () => {
    assertMatch(mk().render("> [[toc]]\n\n# A\n"), /<blockquote>\s*<nav/);
});

Deno.test("invalid options throw", () => {
    assertThrows(() => toc({ level: "2" as unknown as number }), TypeError);
    assertThrows(
        () => toc({ listType: "script" as unknown as "ul" }),
        TypeError,
    );
});

Deno.test("defaultSlugify", () => {
    assertEquals(defaultSlugify("  Hello   World  "), "hello-world");
    assertEquals(defaultSlugify("Ñandú"), "%C3%B1and%C3%BA");
});

Deno.test("permalink injection does not leak whitespace into labels", () => {
    const md: MarkdownIt = new MarkdownIt()
        .use(toc())
        .use(anchor, {
            permalink: anchor.permalink.linkInsideHeader({
                placement: "before",
                symbol: "§",
            }),
        });
    const nav: string = md.render("[[toc]]\n\n# A\n").split("</nav>")[0];
    assertStringIncludes(nav, ">A</a>");
});
