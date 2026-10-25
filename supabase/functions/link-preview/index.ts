// link-preview: reads a shop page and hands back its name, price and main photo,
// so a pasted link can fill in a wishlist item on its own.
// It also takes a one-tap share from an iPhone shortcut (GET ?inbox=<personal key>&url=...):
// the item goes straight onto the rack and the shortcut shows a short note.
// Deploy: Supabase dashboard → Edge Functions → Deploy a new function → Via Editor,
// name it "link-preview", paste this file, Deploy. Then turn JWT verification off for it
// (this function checks the signed-in user itself).

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/* only public web addresses: no local or private networks */
function blockedHost(h: string) {
  h = h.toLowerCase().replace(/\.$/, "");
  if (h === "localhost" || /\.(localhost|local|internal|lan)$/.test(h)) return true;
  if (h.includes(":") || h.startsWith("[")) return true;
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = +m[1], b = +m[2];
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  return false;
}

async function grab(start: string, accept: string, max: number, referer?: string) {
  let u = new URL(start);
  for (let hop = 0; hop < 6; hop++) {
    if (!/^https?:$/.test(u.protocol) || blockedHost(u.hostname)) throw new Error("blocked");
    const res = await fetch(u, {
      redirect: "manual",
      signal: AbortSignal.timeout(9000),
      headers: {
        "User-Agent": UA,
        "Accept": accept,
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.6",
        ...(referer ? { "Referer": referer } : {}),
      },
    });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      await res.body?.cancel();
      u = new URL(loc, u);
      continue;
    }
    if (!res.ok || !res.body) throw new Error("status " + res.status);
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let n = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      n += value.length;
      if (n >= max) { await reader.cancel(); break; }
    }
    const buf = new Uint8Array(n);
    let o = 0;
    for (const c of chunks) { buf.set(c, o); o += c.length; }
    return { buf, type: res.headers.get("content-type") || "", url: u.href };
  }
  throw new Error("too many redirects");
}

function decodeHtml(buf: Uint8Array, type: string) {
  let cs = (type.match(/charset=([\w-]+)/i) || [])[1];
  if (!cs) {
    const head = new TextDecoder("latin1").decode(buf.subarray(0, 4096));
    cs = (head.match(/<meta[^>]+charset=["']?([\w-]+)/i) || [])[1];
  }
  try { return new TextDecoder(cs || "utf-8").decode(buf); } catch { return new TextDecoder().decode(buf); }
}

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const unent = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] ?? all));

function metas(html: string) {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const key = (tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i) || [])[1];
    const cm = tag.match(/\bcontent\s*=\s*"([^"]*)"/i) || tag.match(/\bcontent\s*=\s*'([^']*)'/i);
    if (key && cm && !(key.toLowerCase() in out)) out[key.toLowerCase()] = unent(cm[1]).trim();
  }
  return out;
}

function walk(o: unknown, fn: (x: Record<string, unknown>, depth: number) => void, depth = 0) {
  if (depth > 14 || !o || typeof o !== "object") return;
  if (Array.isArray(o)) { for (const x of o) walk(x, fn, depth + 1); return; }
  fn(o as Record<string, unknown>, depth);
  for (const v of Object.values(o as Record<string, unknown>)) walk(v, fn, depth + 1);
}

const num = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\s*[\d,]+(\.\d+)?\s*$/.test(v)) return +v.replace(/[,\s]/g, "");
  return NaN;
};
const okPrice = (n: number) => isFinite(n) && n >= 100 && n < 100_000_000;

function fromLd(html: string) {
  const r: { name?: string; image?: string; price?: number; currency?: string } = {};
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let j: unknown;
    try { j = JSON.parse(m[1].trim()); } catch { continue; }
    walk(j, (o) => {
      const t = o["@type"];
      if (!(t === "Product" || (Array.isArray(t) && t.includes("Product")))) return;
      if (!r.name && typeof o.name === "string") r.name = o.name;
      const img = Array.isArray(o.image) ? o.image[0] : o.image;
      if (!r.image) r.image = typeof img === "string" ? img : (img && typeof img === "object" ? String((img as Record<string, unknown>).url || "") : undefined);
      const offers = Array.isArray(o.offers) ? o.offers : [o.offers];
      for (const of of offers) {
        if (!of || typeof of !== "object" || r.price) continue;
        const x = of as Record<string, unknown>;
        const spec = x.priceSpecification as Record<string, unknown> | undefined;
        const p = [x.price, x.lowPrice, spec && spec.price].map(num).find(okPrice);
        if (p) { r.price = p; r.currency = String(x.priceCurrency || (spec && spec.priceCurrency) || ""); }
      }
    });
  }
  return r;
}

/* pages built with Next.js keep their data in one big JSON block; look for the selling price there */
function fromNext(html: string) {
  const m = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!m) return null;
  let j: unknown;
  try { j = JSON.parse(m[1]); } catch { return null; }
  const ranks = [
    /^(final|sale|selling|sell|discount(ed)?|current|last)_?(sale_?)?price$/i,
    /^(goods|product|item)_?price$/i,
    /^price$/i,
  ];
  const skip = /(ship|deliver|coupon|point|min|max|limit|free|origin|normal|consumer|retail|list|before|regular|tag)/i;
  let best: { rank: number; depth: number; v: number } | null = null;
  walk(j, (o, depth) => {
    for (const [k, v] of Object.entries(o)) {
      if (skip.test(k)) continue;
      const rank = ranks.findIndex((re) => re.test(k));
      if (rank < 0) continue;
      const n = num(v);
      if (!okPrice(n)) continue;
      if (!best || rank < best.rank || (rank === best.rank && depth < best.depth)) best = { rank, depth, v: n };
    }
  });
  return best ? (best as { v: number }).v : null;
}

const SITES = /(무신사|musinsa|29cm|w\s?컨셉|wconcept|지그재그|zigzag|에이블리|ably|쿠팡|coupang|네이버|naver|스마트스토어|ssg|11번가|g마켓|gmarket|옥션|auction|올리브영|oliveyoung|kream|크림|오늘의집|ohou|컬리|kurly|카카오|kakao)/i;
function cleanTitle(t: string, site: string) {
  t = unent(t).replace(/\s+/g, " ").trim();
  const parts = t.split(/\s+[|｜\-–—:]\s+/).filter((p) => p && !SITES.test(p) && !(site && p.toLowerCase() === site.toLowerCase()) && !/^(사이즈\s*&?\s*후기|후기|리뷰|상품\s*상세|공식\s*(온라인\s*)?(스토어|몰))$/.test(p));
  return (parts.length ? parts.join(" ") : t).slice(0, 80);
}

function b64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function signedIn(req: Request) {
  const auth = req.headers.get("Authorization") || "", apikey = req.headers.get("apikey") || "";
  const base = Deno.env.get("SUPABASE_URL");
  if (!base || !auth.startsWith("Bearer ") || !apikey) return false;
  try {
    const r = await fetch(base + "/auth/v1/user", { headers: { Authorization: auth, apikey } });
    return r.ok;
  } catch { return false; }
}

type PageInfo = { title: string; price: number | null; currency: string; image: string | null; imageUrl: string; site: string; url: string };

async function readPage(url: string, withImage: boolean): Promise<PageInfo> {
  const page = await grab(url, "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", 2_500_000);
  const html = decodeHtml(page.buf, page.type);
  const meta = metas(html);
  const ld = fromLd(html);
  const site = meta["og:site_name"] || new URL(page.url).hostname.replace(/^www\./, "");

  const rawTitle = meta["og:title"] || meta["twitter:title"] || ld.name || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
  const title = rawTitle ? cleanTitle(rawTitle, site) : "";

  let price: number | null = [meta["product:sale_price:amount"], meta["product:price:amount"], meta["og:price:amount"], meta["price"]]
    .map(num).find(okPrice) || ld.price || null;
  let currency = meta["product:price:currency"] || meta["og:price:currency"] || ld.currency || "";
  if (!price) {
    const n = fromNext(html);
    if (n) { price = n; currency = currency || "KRW"; }
  }
  if (!price) {
    const d = meta["og:description"] || meta["description"] || "";
    const m = d.match(/([\d]{1,3}(?:,\d{3})+|\d{4,})\s*원/);
    if (m) { price = +m[1].replace(/,/g, ""); currency = "KRW"; }
  }

  let imageUrl = meta["og:image"] || meta["og:image:url"] || meta["twitter:image"] || ld.image || "";
  if (imageUrl) {
    try { imageUrl = new URL(imageUrl.replace(/^\/\//, "https://"), page.url).href; } catch { imageUrl = ""; }
  }
  let image: string | null = null;
  if (imageUrl && withImage) {
    try {
      const img = await grab(imageUrl, "image/avif,image/webp,image/*;q=0.9,*/*;q=0.5", 6_000_000, page.url);
      const t = (img.type.split(";")[0] || "").trim();
      if (/^image\//.test(t) && img.buf.length > 200 && img.buf.length < 6_000_000) image = "data:" + t + ";base64," + b64(img.buf);
    } catch { /* keep just the address */ }
  }
  return { title, price, currency, image, imageUrl, site, url: page.url };
}

const won = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "원";
const plain = (msg: string) => new Response(msg, { headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8" } });

/* one tap from the share sheet: hang the link on the rack right away; the app adds the photo next time it opens */
async function inbox(q: URLSearchParams) {
  const key = q.get("inbox") || "";
  const raw = q.get("url") || q.get("text") || "";
  const link = (raw.match(/https?:\/\/[^\s<>"']+/) || [])[0];
  const base = Deno.env.get("SUPABASE_URL") || "";
  let apikey = q.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!apikey) { try { apikey = Object.values(JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}"))[0] as string || ""; } catch { /* none */ } }
  if (!link) return plain("공유한 것에서 링크를 못 찾았어요");
  if (key.length < 24 || !base || !apikey) return plain("연결 주소가 맞지 않아요. 앱 설정에서 다시 복사해 주세요");

  let info: PageInfo | null = null;
  try { info = await readPage(link, false); } catch { /* the site would not let us read it */ }
  const now = Date.now();
  const id = now.toString(36) + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  const title = (info && info.title) || "공유한 링크";
  const doc = {
    id, place: "wish", shelf: 1, parent: null, title,
    price: info && info.price ? (!info.currency || /KRW/i.test(info.currency) ? won(info.price) : info.price + " " + info.currency) : "",
    link: (info && info.url) || link, blocks: [{ t: "p", x: "" }], photos: [], created: now, updated: now,
    ...(info && info.imageUrl ? { needsPhoto: true } : {}),
  };
  const r = await fetch(base + "/rest/v1/rpc/inbox_add", {
    method: "POST",
    headers: { apikey, "Content-Type": "application/json" },
    body: JSON.stringify({ p_key: key, p_doc: doc }),
  });
  if (!r.ok) {
    const t = await r.text();
    if (/bad key/.test(t)) return plain("연결 주소가 맞지 않아요. 앱 설정에서 다시 복사해 주세요");
    if (r.status === 404) return plain("서버 준비가 덜 됐어요. inbox.sql을 먼저 실행해 주세요");
    return plain("행거에 걸지 못했어요. 잠시 뒤 다시 해 주세요");
  }
  return plain(info ? "행거에 걸었어요 · " + title : "링크만 걸어 뒀어요 (이 사이트는 정보를 못 읽었어요)");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const q = new URL(req.url).searchParams;
  if (q.get("inbox")) return inbox(q);
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!(await signedIn(req))) return json({ error: "auth" }, 401);

  let url = "";
  try { url = String((await req.json()).url || "").trim(); } catch { /* empty body */ }
  if (!/^https?:\/\//i.test(url)) return json({ error: "url" }, 400);
  try {
    return json(await readPage(url, true));
  } catch (e) {
    return json({ error: "fetch", detail: String((e as Error).message || e) }, 200);
  }
});
