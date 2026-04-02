export interface Env {
  RECEIPTS: KVNamespace;
}

interface ReceiptRecord {
  firstAccessed: string;
  lastAccessed: string;
  accessCount: number;
}

// 1x1 transparent GIF
const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

// Auto-expire records after 90 days (in seconds)
const TTL_SECONDS = 90 * 24 * 60 * 60;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    // GET /pixel/:id — tracking pixel
    const pixelMatch = path.match(/^\/pixel\/([a-zA-Z0-9_-]+)$/);
    if (pixelMatch) {
      const id = pixelMatch[1];
      const now = new Date().toISOString();
      const key = `receipt:${id}`;

      const existing = await env.RECEIPTS.get<ReceiptRecord>(key, "json");
      if (existing) {
        existing.lastAccessed = now;
        existing.accessCount += 1;
        await env.RECEIPTS.put(key, JSON.stringify(existing), {
          expirationTtl: TTL_SECONDS,
        });
      } else {
        const record: ReceiptRecord = {
          firstAccessed: now,
          lastAccessed: now,
          accessCount: 1,
        };
        await env.RECEIPTS.put(key, JSON.stringify(record), {
          expirationTtl: TTL_SECONDS,
        });
      }

      return new Response(TRANSPARENT_GIF, {
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          "Pragma": "no-cache",
          ...corsHeaders(),
        },
      });
    }

    // GET /status/:id — check receipt status
    const statusMatch = path.match(/^\/status\/([a-zA-Z0-9_-]+)$/);
    if (statusMatch) {
      const id = statusMatch[1];
      const record = await env.RECEIPTS.get<ReceiptRecord>(
        `receipt:${id}`,
        "json"
      );

      return new Response(JSON.stringify(record ?? null), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
