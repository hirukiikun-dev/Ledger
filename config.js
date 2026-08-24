/**
 * GET /api/config — hands the browser the PUBLIC Firebase web config.
 *
 * Firebase web keys are safe to expose (your data is protected by Firestore
 * rules, see firestore.rules), but keeping them in env vars means you never
 * commit project details and you can point staging/production at different
 * Firebase projects without touching the code.
 *
 * Returns {} when nothing is configured — the app then runs in local mode.
 */
export default function handler(req, res) {
	const config = {
		apiKey: process.env.FIREBASE_API_KEY || "",
		authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
		projectId: process.env.FIREBASE_PROJECT_ID || "",
		storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
		messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
		appId: process.env.FIREBASE_APP_ID || "",
	};

	res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60");
	if (!config.apiKey || !config.projectId) return res.status(200).json({});
	return res.status(200).json(config);
}
