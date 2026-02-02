const { getCategoryStats, addCategory, getAllUsers } = require('../db');

module.exports = (bot) => {
    bot.onText(/\/admin/, async (msg) => {
        const chatId = msg.chat.id;
        const adminId = process.env.ADMIN_ID;

        if (chatId.toString() !== adminId) {
            return bot.sendMessage(chatId, '❌ Access Denied. This command is only for the administrator.');
        }

        try {
            const users = await getAllUsers();
            const stats = await getCategoryStats();

            let response = `👨‍💼 <b>Admin Panel</b>\n\n`;
            response += `👥 <b>Total Users:</b> ${users.length}\n\n`;
            response += `📊 <b>Users per Category:</b>\n`;

            stats.forEach(cat => {
                response += `• ${cat.name}: <b>${cat.user_count}</b>\n`;
            });

            const opts = {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '➕ Add New Category', callback_data: 'admin_add_category' }],
                        [{ text: '🔄 Refresh Stats', callback_data: 'admin_refresh_stats' }]
                    ]
                }
            };

            bot.sendMessage(chatId, response, opts);
        } catch (err) {
            console.error('Admin command error:', err);
            bot.sendMessage(chatId, '❌ Error fetching stats.');
        }
    });

    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;
        const adminId = process.env.ADMIN_ID;

        if (chatId.toString() !== adminId) return;

        if (query.data === 'admin_add_category') {
            bot.answerCallbackQuery(query.id);
            const prompt = await bot.sendMessage(chatId, '📝 Please send the name of the new category:', {
                reply_markup: { force_reply: true }
            });

            bot.onReplyToMessage(chatId, prompt.message_id, async (reply) => {
                const categoryName = reply.text;
                if (categoryName) {
                    await addCategory(categoryName);
                    bot.sendMessage(chatId, `✅ Category "<b>${categoryName}</b>" added successfully!`, { parse_mode: 'HTML' });
                }
            });
        } else if (query.data === 'admin_refresh_stats') {
            bot.answerCallbackQuery(query.id, { text: 'Refreshing...' });
            // Re-trigger the admin message
            bot.editMessageText('Refreshing...', { chat_id: chatId, message_id: query.message.message_id });
            // We can just call the admin logic again or similar
            const users = await getAllUsers();
            const stats = await getCategoryStats();

            let response = `👨‍💼 <b>Admin Panel</b>\n\n`;
            response += `👥 <b>Total Users:</b> ${users.length}\n\n`;
            response += `📊 <b>Users per Category:</b>\n`;

            stats.forEach(cat => {
                response += `• ${cat.name}: <b>${cat.user_count}</b>\n`;
            });

            const opts = {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '➕ Add New Category', callback_data: 'admin_add_category' }],
                        [{ text: '🔄 Refresh Stats', callback_data: 'admin_refresh_stats' }]
                    ]
                }
            };
            bot.editMessageText(response, opts);
        }
    });
};
