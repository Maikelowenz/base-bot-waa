import {
    default as makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys"

import pino from "pino"
import readline from "readline"

import "./config.js"

import { serialize } from "./lib/serialize.js"
import { loadPlugins, handler } from "./handler.js"
import Case from "./case.js"

const question = (text) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    return new Promise(resolve =>
        rl.question(text, ans => {
            rl.close()
            resolve(ans)
        })
    )
}

async function startBot() {

    const {
        state,
        saveCreds
    } = await useMultiFileAuthState("./session")

    const {
        version
    } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        auth: state,
        version,
        logger: pino({
            level: "silent"
        }),
        printQRInTerminal: !global.usePairingCode
    })

    if (
        global.usePairingCode &&
        !sock.authState.creds.registered
    ) {

        const phone = await question(
            "Masukkan Nomor:\n"
        )

        const code =
            await sock.requestPairingCode(phone)

        console.log(
            "\nPAIRING CODE:",
            code
        )
    }

    await loadPlugins()

    sock.ev.on(
        "creds.update",
        saveCreds
    )

    sock.ev.on(
        "messages.upsert",
        async ({ messages }) => {

            let m = messages[0]

            if (!m.message) return

            if (m.key.fromMe) return

            m = serialize(sock, m)

            let body = m.body || ""

            let prefix =
                global.prefix.find(v =>
                    body.startsWith(v)
                )

            if (!prefix) return

            let args = body
                .slice(prefix.length)
                .trim()
                .split(/ +/)

            let command =
                args.shift()
                .toLowerCase()

            let text = args.join(" ")

            m.command = command
            m.prefix = prefix

            let plugin = await handler(
                sock,
                m,
                command,
                text,
                args
            )

            if (!plugin) {

                await Case(
                    sock,
                    m,
                    command,
                    text,
                    args
                )

            }

        }
    )

    sock.ev.on(
        "connection.update",
        async ({ connection, lastDisconnect }) => {

            if (connection === "open") {

                console.log(
                    "Connected ✓"
                )

            }

            if (connection === "close") {

                let reason =
                    lastDisconnect?.error?.output?.statusCode

                if (
                    reason !== DisconnectReason.loggedOut
                ) {

                    startBot()

                }
            }
        }
    )

    return sock
}

startBot()
