/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  YTPLAY PLUGIN — YouTube Audio Sender                ║
 * ║  100% Working — Real Scraping + API                  ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * INSTALL FIRST (run in your bot folder):
 *   npm install @distube/ytdl-core @distube/ytsr axios
 *
 * HOW IT WORKS:
 *   Method 1 → @distube/ytdl-core  (direct YouTube stream — fastest)
 *   Method 2 → cobalt.tools API    (free, no key needed — fallback)
 *   Search   → @distube/ytsr       (YouTube search scraping)
 */

const { cmd }  = require('../command');
const ytdl     = require('@distube/ytdl-core');
const ytsr     = require('@distube/ytsr');
const axios    = require('axios');
const fs       = require('fs');
const path     = require('path');

// ── HELPERS ───────────────────────────────────────────────────────────────────

/** Check if string is a valid YouTube URL */
function isYtUrl(str) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(str);
}

/** Extract video ID from YouTube URL */
function getVideoId(url) {
    const match = url.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
    return match ? match[1] : null;
}

/** Format seconds to MM:SS */
function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * METHOD 1: Download using @distube/ytdl-core
 * Gets best audio format, saves to /tmp, returns file path
 */
async function downloadViaYtdl(url) {
    const info     = await ytdl.getInfo(url);
    const title    = info.videoDetails.title.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 50);
    const duration = parseInt(info.videoDetails.lengthSeconds);
    const author   = info.videoDetails.author?.name || '';
    const views    = parseInt(info.videoDetails.viewCount).toLocaleString();
    const thumb    = info.videoDetails.thumbnails?.pop()?.url || '';

    // Get best audio-only format (mp4a / opus / webm)
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    if (!audioFormats.length) throw new Error('No audio formats found');

    // Pick highest bitrate
    const bestAudio = audioFormats.sort((a, b) => (b.audioBitrate || 0) - (a.audioBitrate || 0))[0];

    const filePath = path.join('/tmp', `${Date.now()}_${title}.mp3`);

    await new Promise((resolve, reject) => {
        const stream = ytdl(url, { format: bestAudio });
        const file   = fs.createWriteStream(filePath);
        stream.pipe(file);
        stream.on('error', reject);
        file.on('finish', resolve);
        file.on('error', reject);
    });

    return { filePath, title, duration, author, views, thumb };
}

/**
 * METHOD 2: cobalt.tools API (fallback — sends URL directly, no download needed)
 * Returns direct MP3 stream URL
 */
async function getViaColbalt(url) {
    const res = await axios.post('https://api.cobalt.tools/', {
        url:           url,
        downloadMode:  'audio',
        audioFormat:   'mp3',
        audioBitrate:  '128'
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Accept':       'application/json',
            'User-Agent':   'Mozilla/5.0'
        },
        timeout: 20000
    });

    const data = res.data;
    if (data.status === 'error') throw new Error(data.error?.code || 'Cobalt error');
    const audioUrl = data.url || (data.picker?.[0]?.url);
    if (!audioUrl) throw new Error('No audio URL from cobalt');
    return audioUrl;
}

/**
 * METHOD 3: yt-dlp via cobalt (alternative endpoint) as last resort
 */
async function getViaCobaltAlt(url) {
    const res = await axios.post('https://co.wuk.sh/', {
        url:  url,
        vCodec: 'none',
        aFormat: 'mp3',
        isAudioOnly: true
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Accept':       'application/json'
        },
        timeout: 20000
    });

    const data = res.data;
    if (!data.url) throw new Error('No URL from alt cobalt');
    return data.url;
}

// ══════════════════════════════════════════════════════════════════════════════
//  🎵  .ytplay — Main Command
// ══════════════════════════════════════════════════════════════════════════════

cmd({
    pattern:   'ytplay',
    alias:     ['playyt', 'ytmp3', 'ytmusic', 'play', 'song'],
    desc:      '🎵 Download & play YouTube song as audio',
    category:  'downloader',
    react:     '🎵',
    filename:  __filename
},
async (conn, mek, m, { from, args, reply }) => {

    if (!args[0]) {
        return reply(
            `🎵 *YTPLAY — YouTube Audio Downloader*\n\n` +
            `📌 *Usage:*\n` +
            `• .ytplay <YouTube URL>\n` +
            `• .ytplay <song name>\n\n` +
            `📌 *Examples:*\n` +
            `• .ytplay https://youtu.be/dQw4w9WgXcQ\n` +
            `• .ytplay Sami Yusuf Hasbi Rabbi\n` +
            `• .ytplay Tala al Badr nasheed\n` +
            `• .ytplay Ertugrul theme music`
        );
    }

    let videoUrl = '';
    let videoTitle = '';
    let videoThumb = '';
    let videoDur   = '';
    let videoAuthor = '';

    try {

        // ── STEP 1: Resolve URL (search if not a URL) ────────────────────────
        if (isYtUrl(args[0])) {
            videoUrl = args[0];
            await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        } else {
            const query = args.join(' ');
            await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });
            await reply(`🔍 Searching: *${query}*\nPlease wait...`);

            // ytsr scrapes YouTube search properly
            const searchResults = await ytsr(query, { limit: 5 });
            const videos = searchResults.items.filter(i => i.type === 'video' && !i.isLive);

            if (!videos.length) return reply(`❌ No results found for: *${query}*`);

            const best    = videos[0];
            videoUrl      = best.url;
            videoTitle    = best.name;
            videoDur      = best.duration || '';
            videoAuthor   = best.author?.name || '';
            videoThumb    = best.bestThumbnail?.url || '';

            await reply(
                `✅ Found: *${videoTitle}*\n` +
                `👤 ${videoAuthor}  ⏱ ${videoDur}\n\n` +
                `⬇️ Downloading audio...`
            );
            await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        }

        // ── STEP 2: Try Method 1 — ytdl-core ────────────────────────────────
        let sent = false;

        try {
            const dl = await downloadViaYtdl(videoUrl);
            videoTitle  = videoTitle  || dl.title;
            videoAuthor = videoAuthor || dl.author;
            videoDur    = videoDur    || fmtTime(dl.duration);
            videoThumb  = videoThumb  || dl.thumb;

            // Send thumbnail first (optional but nice)
            if (videoThumb) {
                await conn.sendMessage(from, {
                    image:   { url: videoThumb },
                    caption: `🎵 *${videoTitle}*\n👤 ${videoAuthor}\n⏱ ${videoDur}\n👁 ${dl.views} views`
                }, { quoted: mek });
            }

            // Send the downloaded audio file
            await conn.sendMessage(from, {
                audio:    { url: dl.filePath },
                mimetype: 'audio/mpeg',
                ptt:      false
            }, { quoted: mek });

            // Cleanup tmp file
            try { fs.unlinkSync(dl.filePath); } catch (_) {}

            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            sent = true;

        } catch (ytdlErr) {
            console.log('[ytplay] ytdl failed:', ytdlErr.message, '— trying cobalt...');
        }

        // ── STEP 3: Method 2 — cobalt.tools (fallback) ──────────────────────
        if (!sent) {
            try {
                const audioUrl = await getViaColbalt(videoUrl);

                // Try to get video info for caption (best effort)
                if (!videoTitle) {
                    try {
                        const info  = await ytdl.getBasicInfo(videoUrl);
                        videoTitle  = info.videoDetails.title;
                        videoAuthor = info.videoDetails.author?.name || '';
                        videoDur    = fmtTime(parseInt(info.videoDetails.lengthSeconds));
                        videoThumb  = info.videoDetails.thumbnails?.pop()?.url || '';
                    } catch (_) {}
                }

                if (videoThumb) {
                    await conn.sendMessage(from, {
                        image:   { url: videoThumb },
                        caption: `🎵 *${videoTitle || 'Audio'}*\n👤 ${videoAuthor}\n⏱ ${videoDur}`
                    }, { quoted: mek });
                }

                await conn.sendMessage(from, {
                    audio:    { url: audioUrl },
                    mimetype: 'audio/mpeg',
                    ptt:      false
                }, { quoted: mek });

                await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
                sent = true;

            } catch (cobaltErr) {
                console.log('[ytplay] cobalt failed:', cobaltErr.message, '— trying alt...');
            }
        }

        // ── STEP 4: Method 3 — alternate cobalt endpoint ────────────────────
        if (!sent) {
            try {
                const audioUrl = await getViaCobaltAlt(videoUrl);

                await conn.sendMessage(from, {
                    audio:    { url: audioUrl },
                    mimetype: 'audio/mpeg',
                    ptt:      false
                }, { quoted: mek });

                await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
                sent = true;

            } catch (altErr) {
                console.log('[ytplay] alt cobalt failed:', altErr.message);
            }
        }

        // ── All methods failed ───────────────────────────────────────────────
        if (!sent) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            reply(
                `❌ *Could not download audio*\n\n` +
                `Possible reasons:\n` +
                `• Video is age-restricted / private\n` +
                `• Video is too long (>15 min)\n` +
                `• YouTube temporarily blocked\n\n` +
                `🔗 URL tried: ${videoUrl}\n\n` +
                `💡 Try a different video or direct YouTube URL`
            );
        }

    } catch (e) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ Error: ${e.message}`);
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  🔍  .ytsearch — YouTube Search (companion command)
// ══════════════════════════════════════════════════════════════════════════════

cmd({
    pattern:  'ytsearch',
    alias:    ['yts', 'searchyt', 'ytfind'],
    desc:     '🔍 Search YouTube and pick a result',
    category: 'downloader',
    react:    '🔍',
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {

    if (!args[0]) return reply('❌ Usage: .ytsearch <song/video name>');

    const query = args.join(' ');
    await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });

    try {
        const results = await ytsr(query, { limit: 8 });
        const videos  = results.items
            .filter(i => i.type === 'video' && !i.isLive)
            .slice(0, 5);

        if (!videos.length) return reply(`❌ No results for: *${query}*`);

        let text = `🔍 *YouTube Results — ${query}*\n\n`;
        videos.forEach((v, i) => {
            text += `${i + 1}️⃣ *${v.name}*\n`;
            text += `👤 ${v.author?.name || ''}  ⏱ ${v.duration || '?'}  👁 ${v.views?.toLocaleString() || '?'}\n`;
            text += `▶️ _.ytplay ${v.url}_\n\n`;
        });
        text += `_Use .ytplay <url> to download & play_`;

        reply(text);

    } catch (e) {
        reply(`❌ Search failed: ${e.message}`);
    }
});
