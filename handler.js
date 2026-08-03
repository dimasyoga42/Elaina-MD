function isMatch(pattern, command) {
  if (!pattern) return false;
  if (typeof pattern === "string") return pattern === command;
  if (Array.isArray(pattern)) return pattern.includes(command);
  if (pattern instanceof RegExp) return pattern.test(command);
  return false;
}

function extractBody(m) {
  const msg = m.message;
  if (!msg) return "";
  let interactiveId = "";
  const params =
    msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson;
  if (params) {
    try {
      const parsed = JSON.parse(params);
      interactiveId = parsed.id || "";
    } catch {
      interactiveId = "";
    }
  }
  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.buttonsResponseMessage?.selectedButtonId ||
    msg.buttonsResponseMessage?.selectedDisplayText ||
    msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg.templateButtonReplyMessage?.selectedId ||
    interactiveId ||
    ""
  );
}

export async function runCommand(conn, m, plugins) {
  const prefix = ".";
  const body = extractBody(m);
  if (!body) return;
  if (!body.startsWith(prefix)) return;

  const input = body.slice(prefix.length).trim();
  const [command, ...args] = input.split(/\s+/);
  const text = args.join(" ");

  const isButtonResponse =
    m.message?.buttonsResponseMessage ||
    m.message?.interactiveResponseMessage ||
    m.message?.listResponseMessage ||
    m.message?.templateButtonReplyMessage;

  if (isButtonResponse) {
    console.log(`[Button] ${m.sender} → ${body}`);
  }

  for (const name in plugins) {
    const plugin = plugins[name];
    if (!plugin) continue;

    const matched =
      isMatch(plugin.command, command) || isMatch(plugin.alias, command);
    if (!matched) continue;

    const needsArgs = plugin.required && args.length === 0 && !text;

    if (needsArgs) {
      const helpText = plugin.help
        ? `Format salah!\n${plugin.help}`
        : `Format salah! Gunakan ${prefix}${command} <argumen>`;

      await conn
        .sendMessage(m.chat, { text: helpText }, { quoted: m })
        .catch((err) => console.error(`[runCommand] gagal kirim help "${name}":`, err));

      return;
    }

    try {
      await plugin(m, {
        conn,
        args,
        text,
        command,
      });
    } catch (err) {
      console.error(`[runCommand] plugin error "${name}":`, err);
    }
    return;
  }

  console.log(
    `[runCommand] Tidak ada plugin cocok untuk command: "${command}"`,
  );
}

export async function runEvent(conn, event, plugins) {
  for (const name in plugins) {
    const plugin = plugins[name];
    if (!plugin) continue;
    if (plugin.on !== event.type) continue;
    try {
      await plugin(event, { conn });
    } catch (err) {
      console.error(`event plugin error "${name}":`, err);
    }
  }
}
