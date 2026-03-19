const { cmd } = require('../command');
const config = require('../config');

// Function to check if sender is Bot Owner (from config.OWNER_NUMBER)
function isBotOwner(senderId) {
    // Get owner number from config
    const ownerNumber = config.OWNER_NUMBER || '';
    
    // Extract sender's phone number
    let senderNumber = senderId;
    if (senderId.includes(':')) {
        senderNumber = senderId.split(':')[0];
    } else if (senderId.includes('@')) {
        senderNumber = senderId.split('@')[0];
    }
    
    // Clean the numbers (remove any non-digit characters)
    const cleanSender = senderNumber.replace(/\D/g, '');
    const cleanOwner = ownerNumber.replace(/\D/g, '');
    
    // Check if sender matches owner
    if (!cleanOwner || !cleanSender) return false;
    
    // Support multiple owners (comma separated)
    const owners = cleanOwner.split(',').map(o => o.trim());
    
    return owners.some(owner => {
        return cleanSender === owner || 
               cleanSender.includes(owner) || 
               owner.includes(cleanSender);
    });
}

// Function to check if bot is admin
async function checkBotAdmin(conn, chatId) {
    try {
        const metadata = await conn.groupMetadata(chatId);
        const participants = metadata.participants || [];
        
        const botId = conn.user?.id || '';
        const botLid = conn.user?.lid || '';
        
        const botNumber = botId.includes(':') 
            ? botId.split(':')[0] 
            : (botId.includes('@') ? botId.split('@')[0] : botId);
        
        const botLidNumeric = botLid.includes(':') 
            ? botLid.split(':')[0] 
            : (botLid.includes('@') ? botLid.split('@')[0] : botLid);
        
        for (let p of participants) {
            if (p.admin === "admin" || p.admin === "superadmin") {
                const pId = p.id ? p.id.split('@')[0] : '';
                const pLid = p.lid ? p.lid.split('@')[0] : '';
                const pPhoneNumber = p.phoneNumber ? p.phoneNumber.split('@')[0] : '';
                const pLidNumeric = pLid.includes(':') ? pLid.split(':')[0] : pLid;
                const pFullId = p.id || '';
                const pFullLid = p.lid || '';
                
                const botMatches = (
                    botId === pFullId ||
                    botId === pFullLid ||
                    botLid === pFullLid ||
                    botLidNumeric === pLidNumeric ||
                    botNumber === pPhoneNumber ||
                    botNumber === pId
                );
                
                if (botMatches) return true;
            }
        }
        return false;
    } catch (err) {
        return false;
    }
}

// Function to get all kickable members
async function getKickableMembers(conn, chatId) {
    try {
        const metadata = await conn.groupMetadata(chatId);
        const participants = metadata.participants || [];
        
        const botId = conn.user?.id || '';
        const botLid = conn.user?.lid || '';
        
        const botNumber = botId.includes(':') 
            ? botId.split(':')[0] 
            : (botId.includes('@') ? botId.split('@')[0] : botId);
        
        const botLidNumeric = botLid.includes(':') 
            ? botLid.split(':')[0] 
            : (botLid.includes('@') ? botLid.split('@')[0] : botLid);
        
        const kickable = [];
        
        for (let p of participants) {
            if (p.admin === "admin" || p.admin === "superadmin") {
                continue;
            }
            
            const pId = p.id ? p.id.split('@')[0] : '';
            const pLid = p.lid ? p.lid.split('@')[0] : '';
            const pPhoneNumber = p.phoneNumber ? p.phoneNumber.split('@')[0] : '';
            const pLidNumeric = pLid.includes(':') ? pLid.split(':')[0] : pLid;
            const pFullId = p.id || '';
            const pFullLid = p.lid || '';
            
            const isBot = (
                botId === pFullId ||
                botId === pFullLid ||
                botLid === pFullLid ||
                botLidNumeric === pLidNumeric ||
                botNumber === pPhoneNumber ||
                botNumber === pId
            );
            
            if (!isBot && p.id) {
                kickable.push(p.id);
            }
        }
        
        return kickable;
    } catch (err) {
        return [];
    }
}

cmd({
    pattern: "kickall",
    alias: ["removeall", "cleargroup"],
    desc: "Remove all members at once (Bot Owner Only)",
    category: "owner",
    react: "⚠️",
    filename: __filename
},
async (Void, citel, text) => {
    try {
        if (!citel.isGroup) {
            return citel.reply("❌ This command works only in groups!");
        }
        
        const senderId = citel.key?.participant || citel.sender || citel.key?.remoteJid;
        if (!senderId) {
            return citel.reply("❌ Could not identify sender.");
        }
        
        // Only Bot Owner can use (from config.OWNER_NUMBER)
        if (!isBotOwner(senderId)) {
            return citel.reply(`❌ *ACCESS DENIED!*\n\n⚠️ Only *Bot Owner* can use this command!\n\n_This command is restricted to bot owner only._`);
        }
        
        const botIsAdmin = await checkBotAdmin(Void, citel.chat);
        if (!botIsAdmin) {
            return citel.reply("❌ I need to be an *admin* to kick members!");
        }
        
        const members = await getKickableMembers(Void, citel.chat);
        
        if (members.length === 0) {
            return citel.reply("❌ No members found to kick!");
        }
        
        // 🚀 KICK ALL MEMBERS AT ONCE - Single Action!
        await Void.groupParticipantsUpdate(citel.chat, members, "remove");
        
        // Success message
        await citel.reply(`✅ *DONE!*\n\n🗑️ Kicked *${members.length}* members at once!`);
        
    } catch (error) {
        console.error("[KICKALL ERROR]", error);
        citel.reply("❌ *Error!* " + error.message);
    }
});
