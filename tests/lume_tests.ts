import lume from "https://cdn.jsdelivr.net/gh/lumeland/lume@3.3.1/mod.ts";
import { EmptyWriter } from "https://cdn.jsdelivr.net/gh/lumeland/lume@3.3.1/core/writer.ts";
import { toc } from "../mod.ts";

Deno.test("toc en lume", async (t: Deno.TestContext): Promise<void> => {
    const site = lume({ cwd: import.meta.dirname, src: "fixtures" }, {
        markdown: {
            options: { html: true },
            plugins: [toc({ level: [2, 3], listType: "ul" })],
        },
    });
    site.writer = new EmptyWriter(); // no escribe a disco
    await site.build();

    for (const page of site.pages) {
        await t.assertSnapshot([page.outputPath, page.content]);
    }
});
