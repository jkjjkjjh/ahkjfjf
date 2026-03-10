const { cmd } = require('../command');
const axios = require('axios');
const yts = require('yt-search');

cmd({
    pattern: "play",
    alias: ["ply", "pp", "ppl"],
    desc: "Searches a song on YouTube and downloads it as MP3",
    category: "download",
    react: "🎵",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        const query = q ? q.trim() : '';

        if (!query) {
            return await reply(`╭━〔 🎵 DML MUSIC ENGINE 〕━⬣
┃ ⚠️ No input detected.
┃
┃ ➤ Send a song name or YouTube link.
┃
┃ ✦ Example:
┃   .play komasava
┃   .play https://youtu.be/dQw4w9WgXcQ
╰━━━━━━━━━━━━━━━━━━⬣
> 🚀 Powered by Dml Tech`);
        }

        await conn.sendMessage(from, {
            react: { text: '⌛', key: m.key }
        });

        const isYoutubeLink =
            /(?:https?:\/\/)?(?:youtu\.be\/|(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|v\/|embed\/|shorts\/)?)([a-zA-Z0-9_-]{11})/i.test(query);

        let videoUrl = query;
        let title = 'Unknown YouTube Song';
        let thumbnail = '';
        let duration = '';
        let author = 'Unknown';
        let views = 0;

        if (!isYoutubeLink) {
            const search = await yts(query);

            if (!search?.videos?.length) {
                await conn.sendMessage(from, {
                    react: { text: '❌', key: m.key }
                });

                return await reply(`╭━〔 🔎 NO RESULTS FOUND 〕━⬣
┃ No matching results for:
┃ ➤ "${query}"
┃
┃ Try:
┃   • Different keywords
┃   • Artist name + song title
╰━━━━━━━━━━━━━━━━━━⬣
> 🎵 DmlSearch Engine`);
            }

            const video = search.videos[0];
            videoUrl = video.url;
            title = video.title || title;
            thumbnail = video.thumbnail || '';
            duration = video.timestamp || '';
            author = video.author?.name || 'Unknown';
            views = video.views || 0;
        } else {
            const videoId = query.match(/([a-zA-Z0-9_-]{11})/i)?.[1];
            const search = await yts({ videoId: videoId });

            if (search) {
                title = search.title || title;
                thumbnail = search.thumbnail || '';
                duration = search.timestamp || '';
                videoUrl = search.url || query;
                author = search.author?.name || 'Unknown';
                views = search.views || 0;
            }
        }

        const apiUrl = `https://api.giftedtech.co.ke/api/download/ytmp3v2?apikey=gifted&url=${encodeURIComponent(videoUrl)}&quality=128`;

        const response = await axios.get(apiUrl);
        const data = response.data;

        const result = data.result || data.results || data;

        const audioUrl =
            result.download_url ||
            result.downloadUrl ||
            result.url ||
            result.audio ||
            result.link;

        // Update title and thumbnail from API if available
        title = result.title || result.name || title || 'Unknown YouTube Song';
        thumbnail = result.thumbnail || result.image || thumbnail || '';

        if (!audioUrl) {
            await conn.sendMessage(from, {
                react: { text: '❌', key: m.key }
            });

            return await reply(`╭━〔 ❌ DOWNLOAD FAILED 〕━⬣
┃ Unable to process your request.
┃
┃ ➤ Possible Reasons:
┃   • Song not found
┃   • Video unavailable
┃   • API returned no audio URL
┃
┃ Please try again.
╰━━━━━━━━━━━━━━━━━━⬣
> 🎵 DmlDownloader`);
        }

        const safeTitle = title.replace(/[<>:"/\\|?*]/g, '_').trim();

        // ✅ First: Send Thumbnail Image with Song Info
        await conn.sendMessage(from, {
            image: { url: thumbnail },
            caption: `🎧 *DML AUDIO DOWNLOADER*
╭━━━━━━━━━━━━━━━⬣
┃ 🎵 *Title:* ${safeTitle}
┃ 👤 *Author:* ${author}
┃ ⏱️ *Duration:* ${duration}
┃ 👁️ *Views:* ${views.toLocaleString()}
┃ 📥 *Status:* Downloading...
╰━━━━━━━━━━━━━━━⬣
> ⚡ *Powered by DARKZONE-MD*`
        }, { quoted: mek });

        // ✅ Second: Send Audio File
        await conn.sendMessage(from, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${safeTitle}.mp3`
        }, { quoted: mek });

        // ✅ Success Reaction
        await conn.sendMessage(from, {
            react: { text: '✅', key: m.key }
        });

    } catch (error) {
        console.error('Play error:', error);

        await conn.sendMessage(from, {
            react: { text: '❌', key: m.key }
        });

        await reply(`╭━〔 🚨 PLAY ERROR 〕━⬣
┃ Something went wrong while processing.
┃
┃ Error:
┃ ${error.message}
┃
┃ Please try again later.
╰━━━━━━━━━━━━━━━━━━⬣
> 🛠️ DARKZONE-MD System`);
    }
});
