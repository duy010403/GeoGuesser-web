export default function handler(req, res) {
  const allowedOrigins = [
    "https://duy010403.github.io",                   // GitHub Pages
    "https://geo-guesser-web.vercel.app"             // Vercel production domain thật sự
  ];
  const origin = req.headers.origin || "";

  if (!allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  return res.status(200).json({ apiKey: process.env.GOOGLE_MAPS_API_KEY });
}
