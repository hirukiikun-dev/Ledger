/* =====================================================================
   Ledger — Firebase adapter (optional)
   ---------------------------------------------------------------------
   This module is what turns Ledger from "local device only" into a
   synced, logged-in web app. It:
     1. asks /api/config for the PUBLIC Firebase web config
        (filled from .env.local locally / Vercel env vars in production)
     2. if the config is empty, it does nothing — the app stays offline
     3. otherwise it exposes window.LEDGER_CLOUD and fires
        "ledger-cloud-ready" so app.js can attach the auth listener

   Firestore layout:  users/{uid}  ->  { trades: [...], journals: {...}, updatedAt }
   ===================================================================== */

const SDK = "https://www.gstatic.com/firebasejs/10.12.2";

async function getConfig() {
	// Allow a hardcoded override for plain static hosting (no serverless):
	if (window.LEDGER_FIREBASE_CONFIG?.apiKey) return window.LEDGER_FIREBASE_CONFIG;
	try {
		const res = await fetch("/api/config", { cache: "no-store" });
		if (!res.ok) return null;
		const cfg = await res.json();
		return cfg && cfg.apiKey ? cfg : null;
	} catch {
		return null; // opened as a local file, or no serverless runtime
	}
}

(async function boot() {
	const config = await getConfig();
	if (!config) {
		console.info("[Ledger] No Firebase config found — running in local mode.");
		return;
	}

	const [{ initializeApp }, auth, db] = await Promise.all([
		import(`${SDK}/firebase-app.js`),
		import(`${SDK}/firebase-auth.js`),
		import(`${SDK}/firebase-firestore.js`),
	]);

	const app = initializeApp(config);
	const A = auth.getAuth(app);
	const D = db.getFirestore(app);
	await auth.setPersistence(A, auth.browserLocalPersistence);

	const userDoc = () => {
		const u = A.currentUser;
		if (!u) throw new Error("Not signed in");
		return db.doc(D, "users", u.uid);
	};

	window.LEDGER_CLOUD = {
		async signIn(email, password) {
			try {
				const { user } = await auth.signInWithEmailAndPassword(A, email, password);
				return user;
			} catch (err) {
				// First time on this project? Create the account instead of failing.
				if (["auth/user-not-found", "auth/invalid-credential"].includes(err.code)) {
					const { user } = await auth.createUserWithEmailAndPassword(A, email, password);
					return user;
				}
				throw new Error(friendly(err));
			}
		},
		async signUp(email, password) {
			try {
				const { user } = await auth.createUserWithEmailAndPassword(A, email, password);
				return user;
			} catch (err) {
				throw new Error(friendly(err));
			}
		},
		signOut() {
			return auth.signOut(A);
		},
		async load() {
			const snap = await db.getDoc(userDoc());
			return snap.exists() ? snap.data() : null;
		},
		async save(state) {
			if (!A.currentUser) return;
			await db.setDoc(
				userDoc(),
				{
					trades: state.trades ?? [],
					journals: state.journals ?? {},
					settings: { ...state.settings, aiKey: "" }, // never sync the API key
					updatedAt: Date.now(),
				},
				{ merge: true },
			);
		},
		onUser(cb) {
			return auth.onAuthStateChanged(A, cb);
		},
	};

	function friendly(err) {
		const map = {
			"auth/invalid-email": "That email address doesn't look right.",
			"auth/missing-password": "Enter your password.",
			"auth/weak-password": "Use at least 6 characters for the password.",
			"auth/email-already-in-use": "That email already has an account — check the password.",
			"auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
		};
		return map[err.code] || err.message || "Sign-in failed";
	}

	window.dispatchEvent(new Event("ledger-cloud-ready"));
	console.info("[Ledger] Firebase ready — sync enabled.");
})();
