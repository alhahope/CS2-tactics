import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the CS2 stratbook landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  const text = html.replace(/<!--\s*-->/g, "").replace(/\s+/g, " ");
  assert.match(html, /CS2 Stratbook|CS Stratbook/i);
  assert.match(html, /临场战术板/);
  assert.match(text, /7 张现役图 · 108 套战术/);
  assert.match(html, /雷达/);
  assert.match(html, /真实地图模式/);
  assert.match(html, /道具清单/);
  assert.match(html, /路线图/);
  assert.match(html, /MAP DNA/);
  assert.match(html, /打法标签/);
  assert.match(html, /非官方粉丝工具/);

  for (const mapName of [
    "Mirage",
    "Inferno",
    "Nuke",
    "Ancient",
    "Anubis",
    "Dust II",
    "Cache",
    "Overpass",
    "Train",
  ]) {
    assert.match(html, new RegExp(mapName.replace(" ", "\\s+")));
  }

  assert.doesNotMatch(html, /react-loading-skeleton|Building your site|codex-preview/i);
});

test("keeps the tactic data and UI source complete", async () => {
  const [page, css, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  const tactics = page.match(/id: "[^"]+", side: "(?:T|CT)"/g) ?? [];
  assert.equal(tactics.length, 108);
  assert.equal((page.match(/pool: "现役",/g) ?? []).length, 7);
  assert.equal((page.match(/pool: "备用",/g) ?? []).length, 2);
  assert.match(page, /side: "T"/);
  assert.match(page, /side: "CT"/);
  assert.match(page, /goal: "爆点"/);
  assert.match(page, /goal: "反清"/);
  assert.match(page, /function Radar/);
  assert.match(page, /route-segment/);
  assert.match(page, /routeGraphsByMap/);
  assert.match(page, /function guidedLeg/);
  assert.match(page, /mapIntelByMap/);
  assert.match(page, /mapAreasByMap/);
  assert.match(page, /mapBlueprintsByMap/);
  assert.match(page, /map-area-layer/);
  assert.match(page, /radar-blueprint/);
  assert.match(page, /maps\/\$\{map\.id\}\.png/);
  assert.match(page, /researchTacticsByMap/);
  assert.match(css, /\.blueprint-path\.site/);
  assert.match(css, /\.map-area\.site/);
  assert.match(css, /\.radar-point\.active span/);
  assert.match(css, /\.map-intel-card/);
  assert.match(css, /\.route-segment::after/);
  assert.match(css, /\.route-segment\.is-terminal::after/);
  assert.match(layout, /lang="zh-CN"/);
  assert.doesNotMatch(page, /_sites-preview|SkeletonPreview|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
