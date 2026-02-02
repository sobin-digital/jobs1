require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { getPremiumUsers, getCategories, getUsersByCategory } = require('./db');

const token = process.env.BOT_TOKEN;
if (!token) {
    console.error('BOT_TOKEN is missing in .env file');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

app.get('/api/categories', async (req, res) => {
    try {
        const categories = await getCategories();
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

app.post('/api/post-job', async (req, res) => {
    const { title, description, buttonName, buttonLink, categoryId } = req.body;

    if (!title || !description || !buttonName || !buttonLink || !categoryId) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const targetUsers = await getUsersByCategory(categoryId);
        const message = `🌟 <b>New Job Posting!</b>\n\n📌 <b>${title}</b>\n\n${description}`;
        const opts = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: buttonName, url: buttonLink }]]
            }
        };

        const sendPromises = targetUsers.map(user =>
            bot.sendMessage(user.telegram_id, message, opts)
                .then(() => ({ success: true }))
                .catch(err => ({ success: false, error: err.message }))
        );

        const results = await Promise.allSettled(sendPromises);
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

        res.json({ success: true, count: successCount });
    } catch (err) {
        console.error('Broadcast Error:', err);
        res.status(500).json({ error: 'Failed to broadcast message' });
    }
});

// Load handlers dynamically
const handlersPath = path.join(__dirname, 'handlers');
fs.readdirSync(handlersPath).forEach(file => {
    if (file.endsWith('.js')) {
        const handler = require(path.join(handlersPath, file));
        if (typeof handler === 'function') {
            handler(bot, app);
            console.log(`Loaded handler: ${file}`);
        }
    }
});

app.listen(port, () => {
    console.log(`Web server listening on port ${port}`);
});

console.log('Bot is running...');
