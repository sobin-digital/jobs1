const { saveUser, checkPremium } = require('../db');

module.exports = (bot) => {
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const result = await saveUser(msg.from);
        const isPremium = await checkPremium(chatId);

        let welcomeMsg = `Hello ${msg.from.first_name}!\n\nWelcome to Job Alerts Bot.`;

        if (result.isNew) {
            welcomeMsg += `\n\n🎁 <b>Bonus:</b> You've been granted a <b>1-day Premium trial</b>! Enjoy full access to all features until ${result.trialExpiry.toLocaleDateString()}.`;
        } else {
            welcomeMsg += `\n\n${isPremium ? '🌟 You are a Premium Member.' : '🆓 You are using the Free Version.'}`;
        }

        const opts = {
            parse_mode: 'HTML',
            reply_markup: {
                keyboard: [
                    ['🔍 Browse Jobs', '📂 View Categories'],
                    ['⭐ Premium Features', '👤 My Account']
                ],
                resize_keyboard: true
            }
        };

        bot.sendMessage(chatId, welcomeMsg, opts);
    });
};
