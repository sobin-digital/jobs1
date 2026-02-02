const { getCategories, getUserCategories, toggleUserCategory, checkPremium } = require('../db');

module.exports = (bot) => {
    const sendCategorySelection = async (chatId, messageId = null) => {
        const categories = await getCategories();
        const userCats = await getUserCategories(chatId);
        const isPremium = await checkPremium(chatId);

        let text = `📂 <b>Select Job Categories</b>\n\n`;
        if (isPremium) {
            text += `🌟 <b>Premium Account:</b> You can select <b>multiple</b> categories to receive alerts for.\n`;
        } else {
            text += `🆓 <b>Free Account:</b> You can select <b>one</b> category. Upgrade to Premium to select more!\n`;
        }
        text += `\nYour selections are marked with ✅. Click a category to toggle it.`;

        const inlineKeyboard = [];
        for (let i = 0; i < categories.length; i += 2) {
            const row = [];

            const cat1 = categories[i];
            const isSelected1 = userCats.includes(cat1.id);
            row.push({
                text: `${isSelected1 ? '✅ ' : ''}${cat1.name}`,
                callback_data: `toggle_cat_${cat1.id}`
            });

            if (categories[i + 1]) {
                const cat2 = categories[i + 1];
                const isSelected2 = userCats.includes(cat2.id);
                row.push({
                    text: `${isSelected2 ? '✅ ' : ''}${cat2.name}`,
                    callback_data: `toggle_cat_${cat2.id}`
                });
            }
            inlineKeyboard.push(row);
        }

        const opts = {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: inlineKeyboard }
        };

        if (messageId) {
            bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...opts }).catch(() => { });
        } else {
            bot.sendMessage(chatId, text, opts);
        }
    };

    bot.on('message', async (msg) => {
        if (msg.text === '📂 View Categories') {
            await sendCategorySelection(msg.chat.id);
        }
    });

    bot.on('callback_query', async (query) => {
        if (query.data.startsWith('toggle_cat_')) {
            const categoryId = parseInt(query.data.split('_')[2]);
            const chatId = query.message.chat.id;
            const isPremium = await checkPremium(chatId);

            await toggleUserCategory(chatId, categoryId, isPremium);
            bot.answerCallbackQuery(query.id, { text: 'Categories updated!' });
            await sendCategorySelection(chatId, query.message.message_id);
        }
    });
};
