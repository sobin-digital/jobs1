const { getUser, allJobs } = require('../db');

module.exports = (bot) => {
    bot.on('message', async (msg) => {
        if (msg.text === '🔍 Browse Jobs') {
            const chatId = msg.chat.id;
            const user = await getUser(chatId);

            // Free users see limited jobs
            const visibleJobs = user.is_premium ? allJobs : allJobs.filter(j => !j.isPremium);

            let response = `📋 <b>Available Jobs (${user.is_premium ? 'Premium' : 'Free Preview'})</b>\n\n`;

            visibleJobs.forEach(job => {
                response += `🔹 <b>${job.title}</b>\n`;
                response += `📍 Location: ${job.location}\n`;
                response += `📁 Category: ${job.category}\n`;
                response += `🎓 Exp: ${job.exp}\n`;

                if (user.is_premium) {
                    response += `📞 Contact: ${job.contact}\n`;
                } else {
                    response += `📞 Contact: [Locked 🔒 Upgrade to see]\n`;
                }
                response += `---------------------------\n`;
            });

            if (!user.is_premium) {
                response += `\n🚀 <i>Upgrade to Premium to see verified HR contacts and 100+ more daily jobs!</i>`;
            }

            bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
        }
    });
};
