import './config.js';
import pkgBaileys from '@whiskeysockets/baileys';
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = pkgBaileys;
import pino from 'pino';
import readline from 'readline';
import messageHandler from './handler.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session_wa');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        defaultQueryTimeoutMs: undefined,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            let phoneNumber = await question('[?] Masukkan Nomor: ');
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
            let code = await sock.requestPairingCode(phoneNumber);
            console.log(`[+] PAIRING CODE: ${code}`);
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('[+] Bot Terhubung!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (chatUpdate) => {
        if (chatUpdate.type === 'notify') {
            for (const m of chatUpdate.messages) {
                messageHandler(sock, m).catch(console.error);
            }
        }
    });
}

startBot();
