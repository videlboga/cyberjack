const ST_COMPLETIONS_URL = process.env.SILLYTAVERN_API_URL || 'http://127.0.0.1:8181/api/backends/chat-completions/generate';
const ST_COMPLETIONS_ORIGIN = new URL(ST_COMPLETIONS_URL).origin;
const ST_HEALTH_URL = process.env.SILLYTAVERN_HEALTH_URL || `${ST_COMPLETIONS_ORIGIN}/`;
console.log("Health URL:", ST_HEALTH_URL);
try {
  fetch(ST_HEALTH_URL, { method: 'GET', headers: { 'Content-Type': 'application/json' }}).then(r => {
      console.log("Status:", r.status, r.ok);
  }).catch(e => {
      console.log("Fetch Error:", e.message);
  });
} catch (e: any) {
  console.log("Error:", e.message);
}
