const config = require('../config');
const { cmd } = require('../command');
const axios = require('axios');

cmd({
  on: "body"
}, async (conn, m, { isGroup }) => {
  try {
    if (config.MENTION_REPLY !== 'true' || !isGroup) return;
    if (!m.mentionedJid || m.mentionedJid.length === 0) return;

    // ✅ IMPORTANT: Replace ALL these with REAL working Catbox video URLs
    // Fake/placeholder URLs will NOT work!
    const videoClips = [
      "https://files.catbox.moe/zakbt5.mp4",
      "https://files.catbox.moe/PUT_REAL_URL_2.mp4",
      "https://files.catbox.moe/PUT_REAL_URL_3.mp4",
      "https://files.catbox.moe/PUT_REAL_URL_4.mp4",
      "https://files.catbox.moe/PUT_REAL_URL_5.mp4"
      // Add more REAL URLs here...
    ];

    // ✅ FIX: Better bot number extraction (handles both formats)
    const botNumber = conn.user.id.replace(/:\d+/, '') .split('@')[0] + '@s.whatsapp.net';

    // Check if bot was mentioned
    const botMentioned = m.mentionedJid.some(jid => {
      const mentionedNumber = jid.split('@')[0];
      const botNum = botNumber.split('@')[0];
      return mentionedNumber === botNum;
    });

    if (botMentioned) {

      // ✅ Pick random video
      const randomClip = videoClips[Math.floor(Math.random() * videoClips.length)];

      // ✅ FIX: Download video as BUFFER first (ptv requires buffer!)
      let videoBuffer;
      try {
        const response = await axios({
          method: 'get',
          url: randomClip,
          responseType: 'arraybuffer',
          timeout: 30000,  // 30 second timeout
          headers: {
            'User-Agent': 'Mozilla/5.0'
          }
        });
        videoBuffer = Buffer.from(response.data);
      } catch (downloadErr) {
        console.error('Video download failed:', downloadErr.message);
        return;
      }

      // ✅ Check if buffer is valid (not empty)
      if (!videoBuffer || videoBuffer.length < 1000) {
        console.error('Video buffer is empty or too small');
        return;
      }

      // ✅ FIX: Send as Video Note with BUFFER (not URL)
      await conn.sendMessage(m.chat, {
        video: videoBuffer,       // Buffer, NOT { url: ... }
        ptv: true,                // Makes it round circle video note
        gifPlayback: false,
        mimetype: 'video/mp4'     // Explicitly set mimetype
      }, { quoted: m });

      console.log('✅ Video note sent successfully!');
    }
  } catch (e) {
    console.error('Mention Handler Error:', e);
    try {
      const ownerJid = conn.user.id.replace(/:\d+/, '').split('@')[0] + "@s.whatsapp.net";
      await conn.sendMessage(ownerJid, {
        text: `*Bot Error in Mention Handler:*\n${e.message}`
      });
    } catch (err) {
      console.error('Failed to send error report:', err);
    }
  }
});
