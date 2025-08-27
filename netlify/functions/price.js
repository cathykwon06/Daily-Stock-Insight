// netlify/functions/price.js
import * as cheerio from "cheerio";

export async function handler(event) {
  try {
    const qs = new URLSearchParams(event.rawQuery || "");
    const codesParam = qs.get("code") || qs.get("codes");
    if (!codesParam) {
      return json({ error: "Query param 'code' is required. e.g. /api/price?code=005380" }, 400);
    }

    const codes = codesParam
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const results = [];
    for (const code of codes) {
      const url = `https://finance.naver.com/item/main.nhn?code=${code}`;
      
      try {
        const res = await fetch(url, { 
          headers: { 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });
        
        if (!res.ok) {
          results.push({ code, error: `Failed to fetch (${res.status})` });
          continue;
        }
        
        const html = await res.text();
        const $ = cheerio.load(html);

        const priceText = $("div.today p.no_today span.blind").first().text().trim();
        const exdayBlinds = $("div.today p.no_exday span.blind").map((_, el) => $(el).text().trim()).get();
        const changeText = exdayBlinds[0] || "";
        const rateText = exdayBlinds[1] || "";

        results.push({
          code,
          price: textToNumber(priceText),
          priceText,
          change: textToNumber(changeText),
          changeText,
          rateText,
          source: url,
          timestamp: new Date().toISOString()
        });
      } catch (fetchError) {
        results.push({ 
          code, 
          error: `Fetch error: ${fetchError.message}`
        });
      }
    }

    return json({
      updatedAt: new Date().toISOString(),
      results,
      total: results.length
    }, 200);
  } catch (e) {
    return json({ 
      error: e.message || "Unknown error"
    }, 500);
  }
}

function textToNumber(t) {
  if (!t) return null;
  const clean = t.replace(/[,%\s]/g, "");
  const num = Number(clean);
  return Number.isFinite(num) ? num : null;
}

function json(body, status = 200) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body),
  };
}

