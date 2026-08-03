import express from "express";
import {
  createSession,
  getSessionStatus,
  getAllSessions,
  deleteSession,
  restoreAllSessions,
} from "./session.js";

const app = express();

app.use(express.json());

app.get("/pair", async (req, res) => {
  try {
    const phoneNumber = req.query.phoneNumber?.replace(/\D/g, "");

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "phoneNumber wajib diisi",
      });
    }

    const sessionId = `session_${Date.now()}`;

    const { pairingCode } = await createSession(sessionId, phoneNumber, false);

    return res.json({
      success: true,
      sessionId,
      pairingCode,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err?.message || "Unknown Error",
    });
  }
});

app.get("/status/:sessionId", (req, res) => {
  const status = getSessionStatus(req.params.sessionId);

  res.json({
    success: true,
    sessionId: req.params.sessionId,
    status,
  });
});

app.get("/sessions", (req, res) => {
  res.json({
    success: true,
    sessions: getAllSessions(),
  });
});

app.delete("/sessions/:sessionId", async (req, res) => {
  try {
    await deleteSession(req.params.sessionId);

    res.json({
      success: true,
      message: "Session dihapus",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

(async () => {
  try {
    await restoreAllSessions();

    app.listen(3000, () => {
      console.log("🌐 Server Pairing berjalan di http://localhost:3000");
    });
  } catch (err) {
    console.error("Gagal restore session:", err);
  }
})();
