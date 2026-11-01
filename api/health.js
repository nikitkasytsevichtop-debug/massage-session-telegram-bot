/**
 * Health-check / keepalive endpoint (для GitHub Actions-пингера).
 */
export default function handler(req, res) {
  res.status(200).json({ ok: true, ts: Date.now() });
}
