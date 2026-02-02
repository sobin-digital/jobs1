const { getUser, checkPremium } = require('../db');

module.exports = (bot) => {
    bot.on('message', async (msg) => {
        if (msg.text === '👤 My Account') {
            const chatId = msg.chat.id;
            const user = await getUser(chatId);
            const isPremium = await checkPremium(chatId);

            let statusMsg = `👤 <b>Account Details</b>\n\n`;
            statusMsg += `Name: ${msg.from.first_name} ${msg.from.last_name || ''}\n`;
            statusMsg += `Username: ${msg.from.username ? '@' + msg.from.username : 'Not set'}\n`;
            statusMsg += `Status: ${isPremium ? '🌟 Premium' : '🆓 Free'}\n`;

            if (isPremium && user.premium_expiry) {
                const expiry = new Date(user.premium_expiry);
                const now = new Date();
                const diffTime = expiry - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                statusMsg += `Expires: ${expiry.toLocaleDateString()} ${expiry.toLocaleTimeString()}\n`;
                statusMsg += `Remaining: ${diffDays > 0 ? diffDays : 0} days\n`;
            } else if (!isPremium && user.trial_used) {
                statusMsg += `\nTrial used: Yes`;
            }

            bot.sendMessage(chatId, statusMsg, { parse_mode: 'HTML' });
        }
    });
};
