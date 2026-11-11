import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { setPilotAccessToken } from "./pilotApi";

function Pilot() {
  const [ready, setReady] = useState(import.meta.env.DEV);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  if (ready) return <App />;
  return <main style={{ padding: 32, fontFamily: "sans-serif" }}>
    <h1>Campaign video pilot</h1>
    <form onSubmit={async event => {
      event.preventDefault();
      try {
        const response = await fetch("/api/provenance/", { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error("Unable to sign in");
        setPilotAccessToken(token);
        setToken("");
        setReady(true);
      } catch { setError("Unable to sign in. Check your access token and try again."); }
    }}>
      <label>Access token <input type="password" value={token} onChange={event => setToken(event.target.value)} required autoComplete="off" /></label>
      <button type="submit">Sign in</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </main>;
}
createRoot(document.getElementById("root")!).render(<StrictMode><Pilot /></StrictMode>);
