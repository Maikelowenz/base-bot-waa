let handler = async (m, { sock, text }) => {
    if (!text) return m.reply(`*example:*\n${m.cmd} hello`);
    let apis = `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}&delay=500`;
    await sock.sendSticker(m.chat, apis, m, { packname: "wm: skyassistant" });
};

handler.help = "brat";
handler.command = ["brat"];
handler.tags = "Main";

export default handler;
