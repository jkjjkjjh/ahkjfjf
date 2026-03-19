const config = require('../config')
const { cmd } = require('../command')

cmd({
    pattern: "mute",
    alias: ["groupmute"],
    react: "🔇",
    desc: "Mute the group (Only admins can send messages).",
    category: "group",
    filename: __filename
},           
async (conn, mek, m, { from, isGroup, reply, sender }) => {
    try {
        if (!isGroup) return reply("❌ This command can only be used in groups.");
        
        // Get group metadata
        const metadata = await conn.groupMetadata(from);
        const participants = metadata.participants || [];
        
        // Get sender ID from multiple sources
        let senderId = mek.key.participant || m?.participant || sender || m?.sender || mek.participant;
        
        // If message is from bot itself
        if (mek.key.fromMe) {
            senderId = conn.user?.id || conn.user?.lid;
        }
        
        if (!senderId) {
            return reply("❌ Could not identify sender.");
        }
        
        // Function to extract phone number from any ID format
        function getPhone(id) {
            if (!id) return '';
            // Remove everything after @ and :
            let num = id.split('@')[0].split(':')[0];
            // Keep only digits
            return num.replace(/\D/g, '');
        }
        
        // Function to check if two IDs match
        function isMatch(id1, id2) {
            if (!id1 || !id2) return false;
            const p1 = getPhone(id1);
            const p2 = getPhone(id2);
            if (!p1 || !p2) return false;
            // Check exact match or contains
            return p1 === p2 || p1.includes(p2) || p2.includes(p1);
        }
        
        const senderPhone = getPhone(senderId);
        
        // Get owner numbers from config
        let ownerPhones = [];
        if (config.OWNER_NUMBER) {
            const owners = config.OWNER_NUMBER.split(',');
            for (let o of owners) {
                ownerPhones.push(getPhone(o.trim()));
            }
        }
        
        // Check if sender is owner
        const isOwner = ownerPhones.some(op => op && senderPhone && (op === senderPhone || op.includes(senderPhone) || senderPhone.includes(op)));
        
        // Get bot phone
        const botId = conn.user?.id || '';
        const botLid = conn.user?.lid || '';
        const botPhone = getPhone(botId) || getPhone(botLid);
        
        // Check admin status
        let isBotAdmin = false;
        let isSenderAdmin = false;
        
        // Get all admin IDs for comparison
        const adminList = [];
        
        for (let p of participants) {
            const isAdmin = p.admin === "admin" || p.admin === "superadmin";
            
            if (isAdmin) {
                adminList.push({
                    id: p.id,
                    lid: p.lid,
                    phone: getPhone(p.id),
                    lidPhone: getPhone(p.lid)
                });
            }
            
            // Get participant phone numbers
            const pPhone = getPhone(p.id);
            const pLidPhone = getPhone(p.lid);
            
            // Check if this participant is sender
            const isSender = isMatch(p.id, senderId) || 
                            isMatch(p.lid, senderId) ||
                            (pPhone && senderPhone && pPhone === senderPhone) ||
                            (pLidPhone && senderPhone && pLidPhone === senderPhone);
            
            // Check if this participant is bot
            const isBot = isMatch(p.id, botId) || 
                         isMatch(p.id, botLid) ||
                         isMatch(p.lid, botId) ||
                         isMatch(p.lid, botLid) ||
                         (pPhone && botPhone && pPhone === botPhone) ||
                         (pLidPhone && botPhone && pLidPhone === botPhone);
            
            if (isAdmin && isSender) {
                isSenderAdmin = true;
            }
            
            if (isAdmin && isBot) {
                isBotAdmin = true;
            }
        }
        
        // Debug logs
        console.log('╔════════════════════════════════════════╗');
        console.log('║         MUTE COMMAND DEBUG             ║');
        console.log('╠════════════════════════════════════════╣');
        console.log('║ Sender ID:', senderId);
        console.log('║ Sender Phone:', senderPhone);
        console.log('║ Bot ID:', botId);
        console.log('║ Bot LID:', botLid);
        console.log('║ Bot Phone:', botPhone);
        console.log('║ Owner Phones:', ownerPhones.join(', '));
        console.log('║ Is Owner:', isOwner);
        console.log('║ Is Sender Admin:', isSenderAdmin);
        console.log('║ Is Bot Admin:', isBotAdmin);
        console.log('║ Admin List:', JSON.stringify(adminList, null, 2));
        console.log('╚════════════════════════════════════════╝');
        
        // Permission check - Allow owner OR admin
        if (!isOwner && !isSenderAdmin) {
            return reply(`❌ Only group admins or bot owner can use this command.\n\n_Debug: Your number ${senderPhone} was not found in admin list._`);
        }
        
        if (!isBotAdmin) {
            return reply("❌ I need to be an admin to mute the group.");
        }
        
        await conn.groupSettingUpdate(from, "announcement");
        reply("✅ Group has been muted. Only admins can send messages.");
        
    } catch (e) {
        console.error("Error muting group:", e);
        reply(`❌ Failed to mute the group.\n\nError: ${e.message}`);
    }
});
