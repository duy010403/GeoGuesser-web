export default function handler(req, res) {
  const allowedOrigins = [
    "https://duy010403.github.io",
    "https://geo-guesser-web.vercel.app",
    "null",
    ""
  ];

  const origin = req.headers.origin || "";

  // Ghi log để debug
  console.log("Origin received:", origin);

  if (!allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return res.status(200).json({ apiKey: process.env.GOOGLE_MAPS_API_KEY });
}
