/**
 * POST /api/ai  —  Ledger's AI journal coach (Vercel Serverless Function)
 *
 * Keeps your OpenAI key on the server: the browser never sees it.
 * Set OPENAI_API_KEY in .env.local (local) and in Vercel → Project → Settings
 * → Environment Variables (production).
 *
 * Request body:  { model?: string, messages: [{ role, content }] }
 * Response:      { reply: string }
 */

const DEFAULT_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const ENDPOINT = process.env.AI_BASE_URL || "https://api.openai.com/v1";

export default async function handler(req, res) {
	if (req.method === "OPTIONS") return res.status(204).end();
	if (req.method !== "POST") {
		res.setHeader("Allow", "POST");
		return res.status(405).json({ error: "Use POST" });
	}

	const key = process.env.OPENAI_API_KEY;
	if (!key) {
		return res.status(500).json({
			error: "OPENAI_API_KEY is not set. Add it to .env.local or your Vercel environment variables.",
		});
	}

	try {
		const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
		const messages = Array.isArray(body.messages) ? body.messages : null;
		if (!messages?.length) return res.status(400).json({ error: "messages[] is required" });

		const upstream = await fetch(`${ENDPOINT}/chat/completions`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${key}`,
			},
			body: JSON.stringify({
				model: body.model || DEFAULT_MODEL,
				temperature: 0.4,
				max_tokens: 600,
				messages: messages.slice(-12),
			}),
		});

		const data = await upstream.json();
		if (!upstream.ok) {
			return res.status(upstream.status).json({
				error: data?.error?.message || "Upstream AI request failed",
			});
		}

		const reply = data?.choices?.[0]?.message?.content?.trim() || "No response.";
		res.setHeader("Cache-Control", "no-store");
		return res.status(200).json({ reply });
	} catch (err) {
		return res.status(500).json({ error: err?.message || "Unexpected server error" });
	}
}
