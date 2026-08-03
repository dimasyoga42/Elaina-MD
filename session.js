import {
  default as makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  proto,
  generateWAMessageFromContent,
  jidDecode,
  downloadContentFromMessage,
  prepareWAMessageMedia,
  generateMessageID,
  generateWAMessage,
} from "@ryuu-reinzz/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import haruka, { Button, ButtonV2 } from "@ryuu-reinzz/luna-lib";
import { runCommand, runEvent } from "./handler.js";
import { plugins } from "./plugins/index.js";
import "./src/config/global.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const activeSessions = new Map();
const sessionStatus = new Map();

const property = {
  proto,
  generateWAMessageFromContent,
  jidDecode,
  downloadContentFromMessage,
  prepareWAMessageMedia,
  generateMessageID,
  generateWAMessage,
};

const extractText = (m) => {
  const msg = m.message;
  if (!msg) return "";
  try {
    const params =
      msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
    if (params) {
      const parsed = JSON.parse(params);
      if (parsed?.id) return parsed.id;
    }
  } catch {}
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.buttonsResponseMessage?.selectedButtonId ||
    msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg.templateButtonReplyMessage?.selectedId ||
    ""
  );
};

export const createSession = async (
  sessionId,
  phoneNumber = null,
  isBot = true,
) => {
  if (activeSessions.has(sessionId)) {
    return {
      sock: activeSessions.get(sessionId),
      pairingCode: null,
    };
  }

  const authFolder = path.join(__dirname, "sessions", sessionId);

  fs.mkdirSync(authFolder, {
    recursive: true,
  });

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({
      level: "silent",
    }),
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    markOnlineOnConnect: false,
  });

  // Tambahkan property tambahan (proto, generateWAMessage, dll) ke setiap socket
  haruka.addProperty(sock, property);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "connecting") {
      sessionStatus.set(sessionId, "connecting");
    }

    if (connection === "open") {
      sessionStatus.set(sessionId, "connected");
      console.log(`[${sessionId}] WhatsApp connected`);
    }

    if (connection === "close") {
      const statusCode = new Boom(lastDisconnect?.error).output?.statusCode;
      console.log(`[${sessionId}] disconnected`, statusCode);
      sessionStatus.set(sessionId, "disconnected");
      activeSessions.delete(sessionId);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log(`[${sessionId}] logged out`);
        await deleteSession(sessionId);
        return;
      }

      setTimeout(async () => {
        try {
          await createSession(sessionId, null, isBot);
        } catch (err) {
          console.error(`[${sessionId}] reconnect error`, err);
        }
      }, 3000);
    }
  });

  // Event peserta grup (kick/join/promote/demote)
  sock.ev.on("group-participants.update", async (event) => {
    try {
      await runEvent(
        sock,
        {
          ...event,
          type: "group_participants_update",
        },
        plugins,
      );
    } catch (err) {
      console.error(`[${sessionId}] group-participants error`, err);
    }
  });

  if (isBot) {
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const m of messages) {
        try {
          if (!m?.message) continue;

          m.text = extractText(m);
          m.chat = m.key.remoteJid;
          m.sender = m.key.participant || m.key.remoteJid;

          await runCommand(sock, m, plugins);
        } catch (err) {
          console.error(`[${sessionId}] Error memproses pesan:`, err);
        }
      }
    });
  }

  activeSessions.set(sessionId, sock);

  let pairingCode = null;

  if (phoneNumber && !state.creds.registered) {
    sessionStatus.set(sessionId, "pairing");
    await new Promise((resolve) => setTimeout(resolve, 5000));
    pairingCode = await sock.requestPairingCode(phoneNumber);
    sessionStatus.set(sessionId, "code_generated");
    console.log(`[${sessionId}] Pairing code: ${pairingCode}`);
  }

  return {
    sock,
    pairingCode,
  };
};

export const getSession = (sessionId) => activeSessions.get(sessionId);

export const getSessionStatus = (sessionId) =>
  sessionStatus.get(sessionId) || "not_found";

export const getAllSessions = () => {
  return Array.from(activeSessions.keys()).map((id) => ({
    id,
    status: sessionStatus.get(id) || "unknown",
  }));
};

export const deleteSession = async (sessionId) => {
  const sock = activeSessions.get(sessionId);

  if (sock) {
    try {
      await sock.logout();
    } catch {}
    try {
      sock.end?.();
    } catch {}
    activeSessions.delete(sessionId);
  }

  sessionStatus.delete(sessionId);

  const authFolder = path.join(__dirname, "sessions", sessionId);

  if (fs.existsSync(authFolder)) {
    fs.rmSync(authFolder, {
      recursive: true,
      force: true,
    });
  }
};

export const restoreAllSessions = async () => {
  const sessionsDir = path.join(__dirname, "sessions");

  if (!fs.existsSync(sessionsDir)) {
    return;
  }

  const folders = fs.readdirSync(sessionsDir);

  console.log(`Menemukan ${folders.length} session tersimpan`);

  for (const sessionId of folders) {
    try {
      console.log(`Restore session ${sessionId}`);
      await createSession(sessionId, null, true);
    } catch (err) {
      console.error(`Gagal restore ${sessionId}:`, err.message);
    }
  }
};
