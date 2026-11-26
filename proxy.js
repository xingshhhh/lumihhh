/**
 * Lumi 大模型中转 · Cloudflare Pages Functions 版
 *
 * 放在 functions/api/proxy.js 时，会自动生成路由 /api/proxy（与网页同域，无跨域问题）。
 *
 * 作用：网页用户填自己的 API Key 后，由此函数转发到对应大模型。
 *      不经过作者电脑，不存储 Key（仅本次请求内存中使用）。
 */

const ALLOWED_HOSTS = [
  "open.bigmodel.cn", "api.siliconflow.cn", "api.openai.com",
  "generativelanguage.googleapis.com", "api.groq.com", "openrouter.ai",
  "api.deepseek.com", "api.moonshot.cn", "dashscope.aliyuncs.com",
  "ark.cn-beijing.volces.com", "api.mistral.ai", "api.together.xyz"
];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({}, CORS, { "Content-Type": "application/json" })
  });
}

export async function onRequest(context) {
  const request = context.request;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (request.method !== "POST") {
    return json({ ok: false, error: "仅支持 POST" }, 405);
  }

  let body = {};
  try { body = await request.json(); } catch (e) {
    return json({ ok: false, error: "body 不是 JSON" }, 400);
  }

  const endpoint = String(body.endpoint || "");
  const key = String(body.key || "") ||
    String(request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const payload = body.payload || {};

  if (!endpoint) return json({ ok: false, error: "缺少 endpoint" }, 400);
  if (!key) return json({ ok: false, error: "缺少 API Key" }, 400);

  let host = "";
  try { host = new URL(endpoint).hostname; } catch (e) {
    return json({ ok: false, error: "endpoint 不是合法 URL" }, 400);
  }
  if (!ALLOWED_HOSTS.includes(host)) {
    return json({ ok: false, error: "目标域名不在白名单：" + host }, 403);
  }

  try {
    let sendBody, sendHeaders;

    if (payload && payload.audioBase64) {
      const bin = atob(payload.audioBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const form = new FormData();
      form.append("model", payload.model || "glm-asr-2512");
      form.append("file", new Blob([bytes], { type: payload.audioType || "audio/wav" }), "voice.wav");
      sendBody = form;
      sendHeaders = { "Authorization": "Bearer " + key };
    } else {
      sendBody = JSON.stringify(payload);
      sendHeaders = { "Content-Type": "application/json", "Authorization": "Bearer " + key };
    }

    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: sendHeaders,
      body: sendBody
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: Object.assign({}, CORS, {
        "Content-Type": upstream.headers.get("content-type") || "application/json"
      })
    });
  } catch (e) {
    return json({ ok: false, error: "转发失败：" + (e && e.message || e) }, 502);
  }
}
