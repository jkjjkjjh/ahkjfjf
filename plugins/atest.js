const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { cmd } = require('../command');
const FormData = require('form-data');

cmd({
    pattern: "toanime",
    alias: ["animeimg"],
    react: "🎨",
    desc: "Convert image into Anime style",
    category: "image",
    use: ".toanime (reply to image)",
    filename: __filename,
},
async (conn, mek, m, { from, quoted, reply }) => {
    try {

        if (!quoted || !quoted.imageMessage) {
            return reply("🖼️ Please reply to an image with `.toanime`");
        }

        await reply("⏳ Converting image to Anime style...");

        // Download image from WhatsApp
        const stream = await downloadContentFromMessage(
            quoted.imageMessage,
            'image'
        );

        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // Upload to tmpfiles
        const form = new FormData();
        form.append('file', buffer, {
            filename: 'anime.jpg',
            contentType: 'image/jpeg'
        });

        const uploadRes = await axios.post(
            'https://tmpfiles.org/api/v1/upload',
            form,
            { headers: form.getHeaders() }
        );

        const imageUrl = uploadRes.data.data.url.replace(
            'tmpfiles.org/',
            'tmpfiles.org/dl/'
        );

        // Call Anime API
        const apiRes = await axios.get(
            `https://api-faa.my.id/faa/toanime?url=${encodeURIComponent(imageUrl)}`,
            { timeout: 60000 }
        );

        // If API returns direct image URL
        let finalImageUrl;

        if (typeof apiRes.data === "string") {
            finalImageUrl = apiRes.data;
        } else if (apiRes.data?.result) {
            finalImageUrl = apiRes.data.result;
        } else {
            return reply("❌ API did not return a valid image.");
        }

        // Download generated image as buffer
        const finalImage = await axios.get(finalImageUrl, {
            responseType: 'arraybuffer'
        });

        // Send image directly to WhatsApp
        await conn.sendMessage(
            from,
            {
                image: Buffer.from(finalImage.data),
                caption: "> 🎨 Anime Image Generated Successfully by 𝐑𝐔𝐇𝐈𝐈𝐈 😻🎀💗"
            },
            { quoted: m }
        );

    } catch (err) {
        console.error("TOANIME ERROR:", err.response?.data || err.message);
        reply("❌ Anime conversion failed. API error occurred.");
    }
});
