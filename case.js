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
                     (type === 'imageMessage') ? m.message.imageMessage.caption : '';

        const isCmd = body.startsWith(global.prefix);
        const command = isCmd ? body.slice(global.prefix.length).trim().split(/ +/).shift().toLowerCase() : '';
        const args = body.trim().split(/ +/).slice(1);

        const reply = async (teks) => {
            await sock.sendMessage(from, { text: teks }, { quoted: m });
        };

        if (isCmd) {
            switch (command) {
                case 'ping':
                    await reply('Pong!');
                    break;
                case 'menu':
                    await reply(`*${global.botName}* Menu\n\n${global.prefix}ping\n${global.prefix}owner`);
                    break;
                case 'owner':
                    await sock.sendMessage(from, { 
                        contacts: { 
                            displayName: global.ownerName, 
                            contacts: [{ vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${global.ownerName}\nTEL;type=CELL;waid=${global.ownerNumber.split('@')[0]}:+${global.ownerNumber.split('@')[0]}\nEND:VCARD` }] 
                        } 
                    }, { quoted: m });
                    break;
            }
        }
    } catch (err) {
        console.error(err);
    }
};
