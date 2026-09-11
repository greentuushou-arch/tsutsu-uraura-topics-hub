#!/usr/bin/env node
/**
 * update.mjs
 * -----------------------------------------------------------------------
 * 「にっぽん津々浦々」トピックス一覧ページ
 *   https://www.rakuten.co.jp/tsutsu-uraura/contents/topicslist/
 * から最新の記事一覧を取得し、articles.js を作り直すスクリプト。
 *
 * 使い方:
 *   node update.mjs
 *
 * 実行すると、その時点でトピックスページに載っている記事を丸ごと
 * 取得し直して articles.js を上書きします。新しい記事の追加・
 * 既存記事のタイトル変更・削除、すべて自動で反映されます。
 *
 * 必要なもの: Node.js 18以降（fetchが標準で使えるバージョン）
 * -----------------------------------------------------------------------
 */

const SOURCE_URL = "https://www.rakuten.co.jp/tsutsu-uraura/contents/topicslist/";
const OUTPUT_FILE = new URL("./articles.js", import.meta.url);

async function main() {
  console.log(`取得中... ${SOURCE_URL}`);
  const res = await fetch(SOURCE_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; tsutsu-uraura-updater/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`ページの取得に失敗しました (HTTP ${res.status})`);
  }
  const html = await res.text();

  const list = extractTopicsList(html);
  console.log(`記事 ${list.length} 件を検出しました`);

  const rows = list.map((item) => {
    const title = cleanTitle(item.title);
    const isRecipe = item.title.trim().startsWith("【レシピ】") ? 1 : 0;
    const thumbBase = item.imageUrl; // クエリ(?fitin=...)なしの元画像URL
    return [item.href, thumbBase, title, isRecipe];
  });

  const recipeCount = rows.filter((r) => r[3] === 1).length;
  console.log(`  内訳: レシピ ${recipeCount} 件 / 特集 ${rows.length - recipeCount} 件`);

  const fileContents =
    `// このファイルは update.mjs が自動生成します。手で編集してもよいですが、\n` +
    `// 次に update.mjs を実行すると上書きされる点に注意してください。\n` +
    `// 生成日時: ${new Date().toISOString()}\n` +
    `const ARTICLES=${JSON.stringify(rows)};\n`;

  await writeFile(OUTPUT_FILE, fileContents);
  console.log(`articles.js を更新しました（${rows.length} 件）`);
  console.log("この後 index.html と一緒にアップロード（またはgit push）してください。");
}

/** HTML内の window.__INITIAL_STATE__ = {...}; から topicsList を取り出す */
function extractTopicsList(html) {
  const marker = "window.__INITIAL_STATE__ = ";
  const start = html.indexOf(marker);
  if (start === -1) {
    throw new Error(
      "window.__INITIAL_STATE__ が見つかりませんでした。楽天側のページ構造が変わった可能性があります。"
    );
  }
  const jsonStart = start + marker.length;
  const nextWindowVar = html.indexOf("window.__", jsonStart);
  const jsonEnd = html.lastIndexOf(";", nextWindowVar === -1 ? html.length : nextWindowVar);
  const json = html.slice(jsonStart, jsonEnd);

  let state;
  try {
    state = JSON.parse(json);
  } catch (err) {
    throw new Error(`ページ内データの解析に失敗しました: ${err.message}`);
  }
  if (!state.topicsList) {
    throw new Error("topicsList が見つかりませんでした。ページ構造が変わった可能性があります。");
  }
  return Object.values(state.topicsList);
}

/** タイトルから【レシピ】タグやブランド表記(｜にっぽん津々浦々 等)を取り除く */
function cleanTitle(raw) {
  let t = raw.split(/[|｜│]/)[0].trim();
  t = t.replace(/^【レシピ】\s*/, "");
  t = t.replace(/^【にっぽん津々浦々】\s*/, "");
  t = t.replace(/\s*にっぽん津々浦々\s*$/, "").trim();
  return t || raw.trim();
}

async function writeFile(url, contents) {
  const fs = await import("node:fs/promises");
  await fs.writeFile(url, contents, "utf8");
}

main().catch((err) => {
  console.error("エラー:", err.message);
  process.exitCode = 1;
});
