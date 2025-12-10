export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res
      .status(500)
      .json({ error: "Telegram env vars not set on Vercel" });
  }

  const body = req.body || {};
  const {
    name = "",
    surname = "",
    group = "",
    book = "",
    unit = "",
    score = "",
    answers = null
  } = body;

  const text =
    `📚 New ELS result\n` +
    `👤 ${name} ${surname}\n` +
    `👥 Group: ${group}\n` +
    `📖 Book: ${book || "N/A"}\n` +
    `🧩 Unit: ${unit || "N/A"}\n` +
    `✅ Score: ${score || "N/A"}\n\n` +
    (answers ? `Answers:\n${JSON.stringify(answers, null, 2)}` : "");

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text })
      }
    );

    if (!tgRes.ok) {
      const errorText = await tgRes.text();
      console.error("Telegram error:", errorText);
      return res.status(500).json({ error: "Failed to send to Telegram" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Telegram request failed:", err);
    return res.status(500).json({ error: "Telegram request failed" });
  }
}
