/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  SCRAPER PLUGIN — 10 Web Scraping Commands           ║
 * ║  🎵 YouTube Audio  📚 Novels  📰 News  🎬 Movies     ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * DEPENDENCIES (run these once):
 *   npm install axios cheerio
 *
 * CDNs & APIs Used:
 *   • cobalt.tools        → YouTube/social media audio download (FREE, no key)
 *   • lightnovelworld.com → Novel search + chapter scraping
 *   • novelbin.com        → Novel PDF + full novel scraping
 *   • gutendex.com        → Free classic books API (Project Gutenberg)
 *   • puppeteer-free      → Pure axios+cheerio scraping (no headless browser)
 */

const { cmd } = require('../command');
const config  = require('../config');
const axios   = require('axios');
const cheerio = require('cheerio');
const fs      = require('fs');
const path    = require('path');

// ── HELPERS ───────────────────────────────────────────────────────────────────

/** Download a file from URL to a tmp path and return the path */
async function downloadFile(url, filename) {
    const tmpPath = path.join('/tmp', filename);
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    fs.writeFileSync(tmpPath, response.data);
    return tmpPath;
}

/** Send audio file to WhatsApp */
async function sendAudioFile(conn, from, mek, filePath, caption = '') {
    await conn.sendMessage(from, {
        audio: { url: filePath },
        mimetype: 'audio/mpeg',
        ptt: false
    }, { quoted: mek });
    if (caption) await conn.sendMessage(from, { text: caption }, { quoted: mek });
}

/** Send a document (PDF/TXT) to WhatsApp */
async function sendDocument(conn, from, mek, filePath, fileName, caption = '') {
    const ext  = path.extname(fileName).toLowerCase();
    const mime = ext === '.pdf' ? 'application/pdf' : 'text/plain';
    await conn.sendMessage(from, {
        document: { url: filePath },
        mimetype: mime,
        fileName,
        caption
    }, { quoted: mek });
}

/** scrapeGet: axios GET with browser-like headers */
async function scrapeGet(url, extraHeaders = {}) {
    const { data } = await axios.get(url, {
        timeout: 15000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            ...extraHeaders
        }
    });
    return data;
}

// ══════════════════════════════════════════════════════════════════════════════
//  🎵  YOUTUBE AUDIO COMMANDS  [ytplay, ytaudio, ytinfo]
// ══════════════════════════════════════════════════════════════════════════════

/**
 * CMD 1 — .ytplay <song name or YouTube URL>
 * Uses cobalt.tools free API → gets direct MP3 link → sends as WhatsApp audio
 * cobalt.tools supports: YouTube, SoundCloud, Twitter, Instagram, TikTok audio
 */
cmd({
    pattern: "ytplay",
    alias: ["playyt", "efu", "ytmusic"],
    desc: "🎵 Download & play YouTube song as audio",
    category: "downloader",
    react: "🎵",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args[0]) return reply('❌ Usage: .ytplay <YouTube URL or song name>\nExample: .ytplay https://youtu.be/xxxxx');

        let url = args[0];

        // If it's a search query (not a URL), search YouTube first
        if (!url.startsWith('http')) {
            const query = args.join(' ');
            await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });
            await reply(`🔍 Searching for: *${query}*\nPlease wait...`);

            // YouTube search via scraping
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;
            const html = await scrapeGet(searchUrl);
            const match = html.match(/"videoId":"([^"]+)"/);
            if (!match) return reply('❌ No results found! Try using a direct YouTube URL.');
            url = `https://www.youtube.com/watch?v=${match[1]}`;
            await reply(`✅ Found! Downloading audio...`);
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // Call cobalt.tools API (free, no API key needed)
        const cobaltRes = await axios.post('https://api.cobalt.tools/', {
            url: url,
            downloadMode: 'audio',
            audioFormat: 'mp3',
            audioBitrate: '128'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 20000
        });

        const cobalt = cobaltRes.data;

        // cobalt returns: { status: 'stream'|'redirect'|'picker', url: '...' }
        if (cobalt.status === 'error') {
            return reply(`❌ Download failed: ${cobalt.error?.code || 'Unknown error'}\nTry a direct YouTube URL.`);
        }

        const audioUrl = cobalt.url || (cobalt.picker && cobalt.picker[0]?.url);
        if (!audioUrl) return reply('❌ Could not get audio link. Try again!');

        await conn.sendMessage(from, { react: { text: '🎵', key: mek.key } });

        // Send audio directly from URL (no download needed)
        await conn.sendMessage(from, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            ptt: false
        }, { quoted: mek });

        await conn.sendMessage(from, {
            text: `🎵 *Audio sent!*\n🔗 Source: ${url}\n_Powered by cobalt.tools_`
        }, { quoted: mek });

    } catch (e) {
        reply(`❌ Error: ${e.message}\nMake sure you give a valid YouTube URL!`);
    }
});


/**
 * CMD 2 — .ytsearch <query>
 * Scrapes YouTube search results and returns top 5 video links with titles
 */
cmd({
    pattern: "ytsearch",
    alias: ["searchyt", "yts", "ytfind"],
    desc: "🔍 Search YouTube and get top results",
    category: "downloader",
    react: "🔍",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args[0]) return reply('❌ Usage: .ytsearch <search query>\nExample: .ytsearch Sami Yusuf nasheed');

        const query = args.join(' ');
        await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });

        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const html = await scrapeGet(searchUrl);

        // Extract video data from YouTube's JSON payload
        const jsonMatch = html.match(/var ytInitialData = ({.+?});<\/script>/s);
        if (!jsonMatch) {
            // Fallback: simple regex extraction
            const ids    = [...html.matchAll(/"videoId":"([^"]{11})"/g)].map(m => m[1]);
            const titles = [...html.matchAll(/"title":{"runs":\[{"text":"([^"]+)"/g)].map(m => m[1]);
            const unique = [...new Set(ids)].slice(0, 5);

            let text = `🔍 *YouTube Results for:* _${query}_\n\n`;
            unique.forEach((id, i) => {
                text += `${i + 1}️⃣ *${titles[i] || 'Video'}*\n🔗 https://youtu.be/${id}\n▶️ .ytplay https://youtu.be/${id}\n\n`;
            });
            text += `_Use .ytplay <link> to download audio_`;
            return reply(text);
        }

        const ytData = JSON.parse(jsonMatch[1]);
        const contents = ytData?.contents?.twoColumnSearchResultsRenderer
            ?.primaryContents?.sectionListRenderer?.contents?.[0]
            ?.itemSectionRenderer?.contents || [];

        const results = contents
            .filter(c => c.videoRenderer)
            .slice(0, 5)
            .map(c => ({
                id:    c.videoRenderer.videoId,
                title: c.videoRenderer.title?.runs?.[0]?.text || 'Unknown',
                views: c.videoRenderer.shortViewCountText?.simpleText || '',
                dur:   c.videoRenderer.lengthText?.simpleText || ''
            }));

        if (!results.length) return reply('❌ No results found!');

        let text = `🔍 *YouTube Results for:* _${query}_\n\n`;
        results.forEach((r, i) => {
            text += `${i + 1}️⃣ *${r.title}*\n`;
            text += `⏱ ${r.dur}  👁 ${r.views}\n`;
            text += `🔗 https://youtu.be/${r.id}\n`;
            text += `▶️ _.ytplay https://youtu.be/${r.id}_\n\n`;
        });
        text += `_Use .ytplay <link> to download & play audio_`;
        reply(text);

    } catch (e) {
        reply(`❌ Search failed: ${e.message}`);
    }
});


/**
 * CMD 3 — .ytinfo <YouTube URL>
 * Scrapes video title, views, duration, description from YouTube
 */
cmd({
    pattern: "ytinfo",
    alias: ["videoinfo", "ytdetails"],
    desc: "📊 Get YouTube video info/details",
    category: "downloader",
    react: "📊",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args[0]) return reply('❌ Usage: .ytinfo <YouTube URL>');

        await conn.sendMessage(from, { react: { text: '📊', key: mek.key } });

        const html = await scrapeGet(args[0]);
        const $    = cheerio.load(html);

        const title   = $('meta[name="title"]').attr('content') || $('title').text().replace(' - YouTube', '');
        const desc    = $('meta[name="description"]').attr('content') || 'No description';
        const thumb   = $('meta[property="og:image"]').attr('content') || '';
        const channel = html.match(/"ownerChannelName":"([^"]+)"/)?.[1] || 'Unknown';
        const views   = html.match(/"viewCount":"([^"]+)"/)?.[1] || 'Unknown';
        const likes   = html.match(/"label":"([^"]+) likes"/)?.[1] || 'Hidden';
        const dur     = html.match(/"approxDurationMs":"([^"]+)"/)?.[1];
        const durFmt  = dur ? `${Math.floor(dur / 60000)}:${String(Math.floor((dur % 60000) / 1000)).padStart(2, '0')}` : 'Unknown';

        // Send thumbnail
        if (thumb) {
            await conn.sendMessage(from, {
                image: { url: thumb },
                caption: `📊 *${title}*\n\n👤 Channel: ${channel}\n👁 Views: ${Number(views).toLocaleString()}\n❤️ Likes: ${likes}\n⏱ Duration: ${durFmt}\n\n📝 ${desc.slice(0, 200)}...\n\n▶️ _.ytplay ${args[0]}_`
            }, { quoted: mek });
        } else {
            reply(`📊 *${title}*\n\n👤 Channel: ${channel}\n👁 Views: ${Number(views).toLocaleString()}\n⏱ Duration: ${durFmt}\n\n📝 ${desc.slice(0, 200)}...`);
        }

    } catch (e) {
        reply(`❌ Failed: ${e.message}`);
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  📚  NOVEL COMMANDS  [novel, novelpdf, novelchapter, urdunovel, islamicbook]
// ══════════════════════════════════════════════════════════════════════════════

/**
 * CMD 4 — .novel <novel name>
 * Searches lightnovelworld.com and returns top results with synopsis
 */
cmd({
    pattern: "novel",
    alias: ["searchnovel", "findnovel", "novellist"],
    desc: "📚 Search for novels and get info",
    category: "novel",
    react: "📚",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args[0]) return reply('❌ Usage: .novel <novel name>\nExample: .novel Solo Leveling');

        const query = args.join(' ');
        await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });

        const searchUrl = `https://lightnovelworld.co/search?title=${encodeURIComponent(query)}`;
        const html      = await scrapeGet(searchUrl);
        const $         = cheerio.load(html);

        const results = [];
        $('.novel-list .novel-item').each((i, el) => {
            if (i >= 5) return;
            const title  = $(el).find('.novel-title').text().trim();
            const link   = 'https://lightnovelworld.co' + ($(el).find('a').attr('href') || '');
            const status = $(el).find('.status').text().trim();
            const chaps  = $(el).find('.chapter-count').text().trim();
            results.push({ title, link, status, chaps });
        });

        if (!results.length) {
            // Try gutendex (free classic books)
            const gutRes  = await axios.get(`https://gutendex.com/books/?search=${encodeURIComponent(query)}`);
            const books   = gutRes.data.results?.slice(0, 5) || [];
            if (!books.length) return reply(`❌ No novels found for: *${query}*`);

            let text = `📚 *Classic Books for:* _${query}_\n_(Project Gutenberg — Free!)_\n\n`;
            books.forEach((b, i) => {
                const author = b.authors?.[0]?.name || 'Unknown';
                text += `${i + 1}️⃣ *${b.title}*\n👤 ${author}\n📥 _.novelpdf ${b.id}_\n\n`;
            });
            return reply(text);
        }

        let text = `📚 *Novel Results for:* _${query}_\n\n`;
        results.forEach((r, i) => {
            text += `${i + 1}️⃣ *${r.title}*\n`;
            text += `📖 Status: ${r.status || 'Unknown'}  |  Chapters: ${r.chaps || '?'}\n`;
            text += `🔗 ${r.link}\n`;
            text += `📥 _.novelchapter ${r.link}_\n\n`;
        });
        text += `_Use .novelchapter <link> to read a chapter_\n_Use .novelpdf <link> to get PDF_`;
        reply(text);

    } catch (e) {
        reply(`❌ Search failed: ${e.message}`);
    }
});


/**
 * CMD 5 — .novelpdf <gutenberg book ID or novel URL>
 * Downloads book from Project Gutenberg and sends as PDF/TXT document
 *
 * Gutenberg book IDs:
 *   1342 = Pride and Prejudice
 *   11   = Alice in Wonderland
 *   1661 = Sherlock Holmes
 *   84   = Frankenstein
 *   74   = Tom Sawyer
 */
cmd({
    pattern: "novelpdf",
    alias: ["getnovel", "bookpdf", "sendnovel"],
    desc: "📥 Download novel and send as document",
    category: "novel",
    react: "📥",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args[0]) return reply(
            `❌ Usage: .novelpdf <Gutenberg Book ID>\n\n` +
            `📚 *Popular Book IDs (Free):*\n` +
            `• 1342 — Pride and Prejudice\n` +
            `• 11   — Alice in Wonderland\n` +
            `• 1661 — Sherlock Holmes Adventures\n` +
            `• 84   — Frankenstein\n` +
            `• 74   — Tom Sawyer\n` +
            `• 2701 — Moby Dick\n` +
            `• 98   — A Tale of Two Cities\n` +
            `• 1232 — The Prince (Machiavelli)\n\n` +
            `Example: .novelpdf 1342`
        );

        const bookId = args[0].replace(/\D/g, ''); // extract digits only
        if (!bookId) return reply('❌ Please provide a valid book ID (numbers only)');

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply(`📥 Fetching book #${bookId} from Project Gutenberg...\nPlease wait...`);

        // Get book metadata
        const metaRes = await axios.get(`https://gutendex.com/books/${bookId}/`);
        const book    = metaRes.data;
        const title   = book.title || `Book ${bookId}`;
        const author  = book.authors?.[0]?.name || 'Unknown Author';
        const formats = book.formats || {};

        // Try to get the best format: txt > html > epub
        let downloadUrl = formats['text/plain; charset=utf-8']
            || formats['text/plain; charset=us-ascii']
            || formats['text/plain']
            || formats['text/html; charset=utf-8']
            || formats['text/html']
            || null;

        if (!downloadUrl) return reply(`❌ No downloadable format found for: *${title}*`);

        // Download the text content
        const textRes  = await axios.get(downloadUrl, {
            timeout: 30000,
            responseType: 'text',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        let content = textRes.data;

        // Clean HTML if needed
        if (downloadUrl.includes('html')) {
            const $   = cheerio.load(content);
            content   = $.text();
        }

        // Trim to max 500KB (WhatsApp file size limit consideration)
        const maxChars = 500000;
        let truncated  = false;
        if (content.length > maxChars) {
            content   = content.slice(0, maxChars);
            truncated = true;
        }

        // Save as .txt file
        const safeTitle = title.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 40);
        const fileName  = `${safeTitle}.txt`;
        const filePath  = path.join('/tmp', fileName);
        fs.writeFileSync(filePath, content, 'utf8');

        const caption = `📚 *${title}*\n👤 Author: ${author}\n📄 ${Math.round(content.length / 1000)}KB${truncated ? ' (first 500KB)' : ''}\n\n_From Project Gutenberg — Free Classic Literature_`;

        await conn.sendMessage(from, {
            document: { url: filePath },
            mimetype: 'text/plain',
            fileName: fileName,
            caption: caption
        }, { quoted: mek });

        // Cleanup
        fs.unlinkSync(filePath);

    } catch (e) {
        reply(`❌ Failed: ${e.message}`);
    }
});


/**
 * CMD 6 — .novelchapter <lightnovelworld URL> [chapter number]
 * Scrapes and sends a novel chapter as text message
 */
cmd({
    pattern: "novelchapter",
    alias: ["readnovel", "chapter", "novelread"],
    desc: "📖 Read a novel chapter",
    category: "novel",
    react: "📖",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args[0]) return reply('❌ Usage: .novelchapter <lightnovelworld URL> [chapter]\nExample: .novelchapter https://lightnovelworld.co/novel/solo-leveling 1');

        let novelUrl = args[0];
        const chapNum = parseInt(args[1]) || 1;

        await conn.sendMessage(from, { react: { text: '📖', key: mek.key } });

        // Build chapter URL
        if (!novelUrl.includes('/chapter-')) {
            novelUrl = `${novelUrl.replace(/\/$/, '')}/chapter-${chapNum}`;
        }

        const html = await scrapeGet(novelUrl);
        const $    = cheerio.load(html);

        const title   = $('h1.novel-title, .novel-title').first().text().trim() ||
                        $('title').text().split('|')[0].trim();
        const chapTitle = $('h2.chapter-title, .chapter-title').first().text().trim() || `Chapter ${chapNum}`;

        // Extract chapter text
        let content = '';
        const textContainer = $('#chapter-container, .chapter-content, #chapterContent, .text-left');
        textContainer.find('p').each((i, el) => {
            const t = $(el).text().trim();
            if (t) content += t + '\n\n';
        });

        if (!content || content.length < 50) {
            return reply(`❌ Could not extract chapter content.\nTry: .novel <novel name> to find a valid link.`);
        }

        // Send long chapters as document
        if (content.length > 3000) {
            const fileName = `${title.slice(0, 30)}_${chapTitle.slice(0, 20)}.txt`.replace(/[^a-zA-Z0-9_.]/g, '_');
            const filePath = path.join('/tmp', fileName);
            const fullText = `📚 ${title}\n${chapTitle}\n\n${'═'.repeat(40)}\n\n${content}`;
            fs.writeFileSync(filePath, fullText, 'utf8');

            await conn.sendMessage(from, {
                document: { url: filePath },
                mimetype: 'text/plain',
                fileName: fileName,
                caption: `📚 *${title}*\n📖 *${chapTitle}*\n\n_Next: .novelchapter ${args[0]} ${chapNum + 1}_`
            }, { quoted: mek });

            fs.unlinkSync(filePath);
        } else {
            reply(`📚 *${title}*\n📖 *${chapTitle}*\n\n${'═'.repeat(30)}\n\n${content}\n\n${'═'.repeat(30)}\n_Next chapter: .novelchapter ${args[0]} ${chapNum + 1}_`);
        }

    } catch (e) {
        reply(`❌ Failed: ${e.message}`);
    }
});


/**
 * CMD 7 — .islamicbook <search query>
 * Searches and downloads Islamic books/PDFs from archive.org
 */
cmd({
    pattern: "islamicbook",
    alias: ["islamicpdf", "islambook", "quranbook"],
    desc: "📗 Download Islamic books as document",
    category: "novel",
    react: "📗",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args[0]) return reply(
            `❌ Usage: .islamicbook <book name>\n\n` +
            `📗 *Example Searches:*\n` +
            `• .islamicbook Sahih Bukhari\n` +
            `• .islamicbook Riyad us Saliheen\n` +
            `• .islamicbook Quran Tafseer\n` +
            `• .islamicbook Seerat un Nabi\n` +
            `• .islamicbook Islamic jurisprudence`
        );

        const query = args.join(' ');
        await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });
        await reply(`🔍 Searching Islamic books for: *${query}*`);

        // Search Archive.org for Islamic books
        const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query + ' islamic')}&fl[]=identifier,title,creator,format&rows=5&output=json&mediatype=texts`;
        const res       = await axios.get(searchUrl, { timeout: 15000 });
        const docs      = res.data?.response?.docs || [];

        if (!docs.length) return reply(`❌ No Islamic books found for: *${query}*`);

        let text = `📗 *Islamic Books — Search: ${query}*\n\n`;
        docs.forEach((d, i) => {
            text += `${i + 1}️⃣ *${d.title || d.identifier}*\n`;
            if (d.creator) text += `👤 ${d.creator}\n`;
            text += `📥 _.islamicpdfget ${d.identifier}_\n\n`;
        });
        text += `_Use .islamicpdfget <identifier> to download_`;
        reply(text);

    } catch (e) {
        reply(`❌ Failed: ${e.message}`);
    }
});


/**
 * CMD 8 — .islamicpdfget <archive.org identifier>
 * Downloads a specific book from archive.org and sends as document
 */
cmd({
    pattern: "islamicpdfget",
    alias: ["archivebook", "getislamicbook"],
    desc: "📥 Download book from archive.org",
    category: "novel",
    react: "📥",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args[0]) return reply('❌ Usage: .islamicpdfget <archive.org identifier>\nFirst use .islamicbook to find one!');

        const identifier = args[0].trim();
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await reply(`📥 Fetching: *${identifier}*\nPlease wait...`);

        // Get metadata from archive.org
        const metaRes = await axios.get(`https://archive.org/metadata/${identifier}`, { timeout: 15000 });
        const meta    = metaRes.data;
        const title   = meta.metadata?.title || identifier;
        const author  = meta.metadata?.creator || 'Unknown';
        const files   = meta.files || [];

        // Find best file: prefer PDF, then epub, then txt
        let fileObj = files.find(f => f.name?.toLowerCase().endsWith('.pdf'))
            || files.find(f => f.name?.toLowerCase().endsWith('.epub'))
            || files.find(f => f.name?.toLowerCase().endsWith('.txt'));

        if (!fileObj) return reply(`❌ No downloadable file found for: *${title}*`);

        const fileUrl  = `https://archive.org/download/${identifier}/${fileObj.name}`;
        const ext      = path.extname(fileObj.name);
        const fileName = `${title.slice(0, 40).replace(/[^a-zA-Z0-9 ]/g, '')}${ext}`;
        const sizeMB   = fileObj.size ? (fileObj.size / 1048576).toFixed(1) : '?';
        const mime     = ext === '.pdf' ? 'application/pdf' : ext === '.epub' ? 'application/epub+zip' : 'text/plain';

        if (parseFloat(sizeMB) > 60) {
            return reply(`❌ File is too large (${sizeMB}MB). WhatsApp allows max 60MB.\nTry a different book.`);
        }

        await conn.sendMessage(from, {
            document: { url: fileUrl },
            mimetype: mime,
            fileName: fileName,
            caption: `📗 *${title}*\n👤 Author: ${author}\n📄 Size: ${sizeMB}MB\n🗂 Format: ${ext.toUpperCase()}\n\n_From Archive.org Free Library_`
        }, { quoted: mek });

    } catch (e) {
        reply(`❌ Failed: ${e.message}`);
    }
});


/**
 * CMD 9 — .lyrics <song name>
 * Scrapes lyrics from lyrics.ovh API (free, no key needed)
 */
cmd({
    pattern: "lyrics",
    alias: ["getlyrics", "songlyrics", "lyric"],
    desc: "🎤 Get song lyrics",
    category: "downloader",
    react: "🎤",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args[0]) return reply('❌ Usage: .lyrics <artist - song name>\nExample: .lyrics Sami Yusuf - Hasbi Rabbi');

        const query    = args.join(' ');
        const parts    = query.split('-').map(s => s.trim());
        const artist   = parts[0] || query;
        const songName = parts[1] || query;

        await conn.sendMessage(from, { react: { text: '🎤', key: mek.key } });

        let lyrics = '';
        let title  = '';

        // Method 1: lyrics.ovh (free API)
        try {
            const lyricsRes = await axios.get(
                `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(songName)}`,
                { timeout: 10000 }
            );
            lyrics = lyricsRes.data?.lyrics || '';
            title  = `${artist} — ${songName}`;
        } catch (_) {}

        // Method 2: search on genius via scraping
        if (!lyrics) {
            const searchRes = await scrapeGet(
                `https://genius.com/search?q=${encodeURIComponent(query)}`,
                { 'Accept': 'text/html' }
            );
            const $     = cheerio.load(searchRes);
            const link  = $('a[class*="SongCard"]').first().attr('href')
                || $('a[href*="genius.com"][href*="-lyrics"]').first().attr('href');

            if (link) {
                const lPage = await scrapeGet(link.startsWith('http') ? link : 'https://genius.com' + link);
                const $l    = cheerio.load(lPage);
                $l('[data-lyrics-container="true"]').find('br').replaceWith('\n');
                title  = $l('h1').first().text().trim();
                lyrics = $l('[data-lyrics-container="true"]').text().trim();
            }
        }

        if (!lyrics) return reply(`❌ Lyrics not found for: *${query}*\nTry: .lyrics <exact artist name> - <exact song name>`);

        // Trim if too long
        if (lyrics.length > 4000) lyrics = lyrics.slice(0, 4000) + '\n\n...[truncated]';

        reply(`🎤 *${title || query}*\n\n${'─'.repeat(30)}\n\n${lyrics}\n\n${'─'.repeat(30)}\n_Use .ytplay ${artist} ${songName} to listen_`);

    } catch (e) {
        reply(`❌ Failed: ${e.message}`);
    }
});


/**
 * CMD 10 — .urdunovel <search query>
 * Scrapes Urdu novels from urdupoint.com or rekhta.org and sends as text/document
 */
cmd({
    pattern: "urdunovel",
    alias: ["urdukitab", "urdubook", "novelurdu"],
    desc: "📕 Find and read Urdu novels",
    category: "novel",
    react: "📕",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args[0]) return reply(
            `❌ Usage: .urdunovel <novel/author name>\n\n` +
            `📕 *Example Searches:*\n` +
            `• .urdunovel Umera Ahmed\n` +
            `• .urdunovel Nimra Ahmed\n` +
            `• .urdunovel Peer e Kamil\n` +
            `• .urdunovel Namal\n` +
            `• .urdunovel Jannat ke Pattay\n` +
            `• .urdunovel Ibn e Safi`
        );

        const query = args.join(' ');
        await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });
        await reply(`🔍 Searching Urdu novels for: *${query}*`);

        // Search archive.org for Urdu novels (many Urdu books are there)
        const archiveUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query + ' urdu novel')}&fl[]=identifier,title,creator&rows=6&output=json&mediatype=texts`;
        const archiveRes = await axios.get(archiveUrl, { timeout: 15000 });
        const archiveDocs = archiveRes.data?.response?.docs || [];

        // Also search urdupoint for info
        let urduPointResults = [];
        try {
            const upHtml = await scrapeGet(`https://www.urdupoint.com/afsany/${encodeURIComponent(query)}`);
            const $up    = cheerio.load(upHtml);
            $up('.novel-item, .story-box, article').slice(0, 3).each((i, el) => {
                const title  = $up(el).find('h2, h3, .title').first().text().trim();
                const link   = $up(el).find('a').attr('href') || '';
                if (title) urduPointResults.push({ title, link: link.startsWith('http') ? link : 'https://www.urdupoint.com' + link });
            });
        } catch (_) {}

        if (!archiveDocs.length && !urduPointResults.length) {
            return reply(`❌ No Urdu novels found for: *${query}*\nTry a different spelling or author name.`);
        }

        let text = `📕 *اردو ناول — ${query}*\n\n`;

        if (urduPointResults.length) {
            text += `🌐 *UrduPoint Results:*\n`;
            urduPointResults.forEach((r, i) => {
                text += `${i + 1}️⃣ *${r.title}*\n🔗 ${r.link}\n\n`;
            });
        }

        if (archiveDocs.length) {
            text += `📚 *Archive.org (Downloadable):*\n`;
            archiveDocs.forEach((d, i) => {
                text += `${i + 1}️⃣ *${d.title || d.identifier}*\n`;
                if (d.creator) text += `👤 ${d.creator}\n`;
                text += `📥 _.islamicpdfget ${d.identifier}_\n\n`;
            });
            text += `_Use .islamicpdfget <identifier> to download as PDF/TXT_`;
        }

        reply(text);

    } catch (e) {
        reply(`❌ Failed: ${e.message}`);
    }
});
