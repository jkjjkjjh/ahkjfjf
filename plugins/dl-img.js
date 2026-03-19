const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

function getGoogleImageSearch(query) {
    const apis = [
        `https://api.giftedtech.co.ke/api/search/googleimage?apikey=gifted&query=${encodeURIComponent(query)}`,
        `https://jawad-tech.vercel.app/search/gimage?q=${encodeURIComponent(query)}`,
        `https://api.delirius.xyz/search/gimage?query=${encodeURIComponent(query)}`,
        `https://api.siputzx.my.id/api/images?query=${encodeURIComponent(query)}`
    ]
    
    const getAll = async () => {
        for (const url of apis) {
            try {
                const res = await axios.get(url)
                const data = res.data
                
                // Handle different response structures
                let urls = []
                
                // For giftedtech API (uses "results" array with direct URL strings)
                if (Array.isArray(data?.results)) {
                    urls = data.results.filter(u => typeof u === 'string' && u.startsWith('http'))
                }
                // For jawad-tech API (uses "result" array with objects containing url)
                else if (Array.isArray(data?.result)) {
                    urls = data.result.map(d => typeof d === 'string' ? d : d.url).filter(u => typeof u === 'string' && u.startsWith('http'))
                }
                // For other APIs (uses "data" array)
                else if (Array.isArray(data?.data)) {
                    urls = data.data.map(d => typeof d === 'string' ? d : d.url).filter(u => typeof u === 'string' && u.startsWith('http'))
                }
                
                if (urls.length) return urls
            } catch (err) {
                console.log(`API failed: ${url}`)
            }
        }
        return []
    }
    
    return { 
        getAll,
        getRandom: async () => {
            const all = await getAll()
            return all[Math.floor(Math.random() * all.length)] || null
        }
    }
}

cmd({
    pattern: "imagen",
    alias: ["image", "img"],
    react: "🕒",
    desc: "Search for images",
    category: "search",
    use: ".imagen <query>",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply(`❀ Please enter a text to search for an Image.`)

        await reply("*🔍 SEARCHING FOR IMAGES...*")

        const res = await getGoogleImageSearch(q)
        const urls = await res.getAll()
        
        if (urls.length < 1) return reply('✧ No images found for your query.')
        
        const medias = urls.slice(0, 10).map(url => ({ image: { url } }))
        const caption = `> DARKZONE-MD RESULTS FOR: ${q}`
        
        // Send multiple images
        for (let media of medias) {
            await conn.sendMessage(from, media, { quoted: m })
        }
        
        await conn.sendMessage(from, { text: caption }, { quoted: m })

    } catch (error) {
        console.error('Image Search Error:', error)
        reply(`⚠️ A problem has occurred.\n\n${error.message}`)
    }
})
