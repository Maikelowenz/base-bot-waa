import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import caseHandler from './case.js';

global.plugins = global.plugins || {};

const loadPlugins = async () => {
    const pluginsDir = path.join(process.cwd(), 'plugins');
    if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir);

    const files = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
    for (const file of files) {
        try {
            const fileUrl = pathToFileURL(path.join(pluginsDir, file)).href;
            const module = await import(`${fileUrl}?update=${Date.now()}`);
            if (module.default) {
                global.plugins[file] = module.default;
            }
        } catch (err) {
            console.error(err);
        }
    }
};

await loadPlugins();

export default async (sock, m) => {
    try {
        if (!m.message) return;

        const from = m.key.remoteJid;
        if (from === 'status@broadcast') return;

        const isGroup = from.endsWith('@g.us');
        const sender = isGroup ? (m.key.participant || m.participant) : from;

        const type = Object.keys(m.message)[0];
        const body = (type === 'conversation') ? m.message.conversation : 
                     (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : 
                     (type === 'imageMessage') ? m.message.imageMessage.caption : 
                     (type === 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId : 
                     (type === 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId : 
                     (type === 'interactiveResponseMessage') ? JSON.parse(m.message.interactiveResponseMessage.nativeFlowResponseBody).resultSelectedId : '';

        if (!body) return;

        const isCmd = body.startsWith(global.prefix);
        const command = isCmd ? body.slice(global.prefix.length).trim().split(/ +/).shift().toLowerCase() : body.trim().split(/ +/).shift().toLowerCase();
        const args = body.trim().split(/ +/).slice(1);
        const text = args.join(' ');

        m.reply = async (teks) => {
            await sock.sendMessage(from, { text: teks }, { quoted: m });
        };
        m.chat = from;
        m.cmd = global.prefix + command;

        sock.sendButton = async (jid, text, footer, buttons, quoted) => {
            let formattedButtons = buttons.map(btn => ({
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({
                    display_text: btn.displayText,
                    id: btn.id
                })
            }));

            let msg = {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            body: { text: text },
                            footer: { text: footer },
                            header: { hasMediaAttachment: false },
                            nativeFlowMessage: {
                                buttons: formattedButtons
                            }
                        }
                    }
                }
            };
            return await sock.sendMessage(jid, msg, { quoted: quoted });
        };

        let handledByCase = await caseHandler(sock, m, command, text);
        
        if (!handledByCase) {
            for (const file in global.plugins) {
                const plugin = global.plugins[file];
                if (plugin.command && plugin.command.includes(command)) {
                    await plugin(m, { sock, text });
                    break;
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
};
