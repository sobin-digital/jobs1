const paypal = require('@paypal/checkout-server-sdk');
const { setPremium, getUser, checkPremium } = require('../db');

// PayPal Environment Setup
const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_SECRET;
const mode = process.env.PAYPAL_MODE || 'sandbox';

const environment = mode === 'live'
    ? new paypal.core.LiveEnvironment(clientId, clientSecret)
    : new paypal.core.SandboxEnvironment(clientId, clientSecret);

console.log(`Using PayPal ${mode === 'live' ? 'Live' : 'Sandbox'} Mode`);
const client = new paypal.core.PayPalHttpClient(environment);

module.exports = (bot) => {
    bot.on('message', async (msg) => {
        if (msg.text === '⭐ Premium Features') {
            const chatId = msg.chat.id;
            const user = await getUser(chatId);
            const isPremium = await checkPremium(chatId);
            const currentPlan = user.premium_plan || 0;

            const isAdmin = chatId.toString() === process.env.ADMIN_ID;

            // Define prices based on user role (Admin gets $1 for all plans)
            const prices = {
                1: isAdmin ? '1' : '5',
                3: isAdmin ? '1' : '12',
                6: isAdmin ? '1' : '20',
                12: isAdmin ? '1' : '26'
            };

            let statusText = '';
            if (isPremium) {
                const expiryDate = new Date(user.premium_expiry).toLocaleDateString();
                statusText = `\n🌟 <b>Your Status: Premium</b>\n📅 <b>Expires:</b> ${expiryDate}\n`;
            }

            const premiumInfo = `
🌟 <b>Premium Features</b> 🌟
${statusText}
✅ <b>All Categories:</b> IT, Sales, Finance, Hospitality, and more.
✅ <b>Direct Contacts:</b> Get phone numbers and HR emails.
✅ <b>Filters:</b> Dubai, Abu Dhabi & more.
✅ <b>Verified Jobs:</b> Only 100% genuine postings.
✅ <b>No Ads:</b> Pure job hunting experience.

<b>Choose your plan:</b>
🎗️ 1 Month — <b>$${prices[1]}</b>
🥉 3 Months — <b>$${prices[3]}</b>
🥈 6 Months — <b>$${prices[6]}</b>
🥇 12 Months — <b>$${prices[12]}</b>

👇 Click below to upgrade and start your career in UAE!
            `;

            const getBtnText = (planMonths, price, months) => {
                if (isPremium && currentPlan === months) return `✅ Active: ${planMonths} ($${price})`;
                return `${planMonths} ($${price})`;
            };

            const opts = {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: getBtnText('🎗️ 1 Month', prices[1], 1), callback_data: isPremium && currentPlan === 1 ? 'plan_already_active' : `upgrade_1_${prices[1]}` }],
                        [{ text: getBtnText('🥉 3 Months', prices[3], 3), callback_data: isPremium && currentPlan === 3 ? 'plan_already_active' : `upgrade_3_${prices[3]}` }],
                        [{ text: getBtnText('🥈 6 Months', prices[6], 6), callback_data: isPremium && currentPlan === 6 ? 'plan_already_active' : `upgrade_6_${prices[6]}` }],
                        [{ text: getBtnText('🥇 12 Months', prices[12], 12), callback_data: isPremium && currentPlan === 12 ? 'plan_already_active' : `upgrade_12_${prices[12]}` }],
                        [{ text: '❓ How it works', callback_data: 'premium_help' }]
                    ]
                },
                parse_mode: 'HTML'
            };

            bot.sendMessage(chatId, premiumInfo, opts);
        }
    });

    bot.on('callback_query', async (query) => {
        const chatId = query.message.chat.id;

        if (query.data === 'plan_already_active') {
            bot.answerCallbackQuery(query.id, { text: 'This plan is already active on your account!', show_alert: true });
            return;
        }

        if (query.data.startsWith('upgrade_')) {
            const parts = query.data.split('_');
            const months = parseInt(parts[1]);
            const price = parts[2];
            const days = months * 30;

            bot.answerCallbackQuery(query.id, { text: `Generating payment link for ${months} months...` });

            const request = new paypal.orders.OrdersCreateRequest();
            request.prefer("return=representation");
            request.requestBody({
                intent: 'CAPTURE',
                application_context: {
                    return_url: 'https://t.me/uaecareeralertsbott',
                    cancel_url: 'https://t.me/uaecareeralertsbot',
                    brand_name: 'UAE Job Alerts Bot',
                    landing_page: 'BILLING',
                    user_action: 'CONTINUE'
                },
                purchase_units: [{
                    amount: {
                        currency_code: 'USD',
                        value: price + '.00'
                    },
                    description: `Job Alerts Bot Premium - ${months} Months`,
                    custom_id: `${days}_${months}` // Storing both days and months
                }]
            });

            try {
                const order = await client.execute(request);
                const approveLink = order.result.links.find(link => link.rel === 'approve').href;
                const orderId = order.result.id;

                const opts = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🔗 Click to Pay via PayPal', url: approveLink }],
                            [{ text: '✅ I have paid', callback_data: `verify_payment_${orderId}` }]
                        ]
                    },
                    parse_mode: 'HTML'
                };

                bot.sendMessage(chatId, `💳 <b>Order Created!</b>\n\nPlan: <b>${months} Months</b>\nPrice: <b>$${price}</b>\n\n1. Click the link below to pay.\n2. After completing payment, click "I have paid" to activate your status.\n\n<b>Order ID:</b> <code>${orderId}</code>`, opts);
            } catch (err) {
                console.error('PayPal Order Error:', err);
                bot.sendMessage(chatId, '❌ Sorry, there was an error generating the payment link. Please try again later.');
            }
        } else if (query.data.startsWith('verify_payment_')) {
            const orderId = query.data.split('_')[2];
            bot.answerCallbackQuery(query.id, { text: 'Verifying payment...' });

            try {
                const getRequest = new paypal.orders.OrdersGetRequest(orderId);
                const order = await client.execute(getRequest);
                const status = order.result.status;
                const customParts = (order.result.purchase_units[0].custom_id || "30_1").split('_');
                const days = parseInt(customParts[0]) || 30;
                const months = parseInt(customParts[1]) || (days / 30);

                if (status === 'COMPLETED') {
                    await setPremium(chatId, days, months);
                    bot.sendMessage(chatId, '🌟 <b>Already Verified!</b> Your account is active. Enjoy your Premium status!', { parse_mode: 'HTML' });
                    return;
                }

                if (status !== 'APPROVED') {
                    bot.sendMessage(chatId, `⚠️ <b>Payment status: ${status}</b>\n\nYou haven't approved the payment on PayPal yet. Please click the link above, complete the payment, and then click "I have paid".`, { parse_mode: 'HTML' });
                    return;
                }

                const request = new paypal.orders.OrdersCaptureRequest(orderId);
                request.requestBody({});
                const capture = await client.execute(request);

                if (capture.result.status === 'COMPLETED') {
                    await setPremium(chatId, days, months);
                    bot.sendMessage(chatId, `🌟 <b>Success!</b> Your account has been upgraded to Premium for ${days} days. Enjoy!`, { parse_mode: 'HTML' });
                } else {
                    bot.sendMessage(chatId, '⚠️ Payment reached unexpected state. Please contact support if you have been charged.');
                }
            } catch (err) {
                console.error('PayPal Verification Error:', err);
                if (err.statusCode === 422) {
                    bot.sendMessage(chatId, '❌ <b>Payment Error:</b> The request could not be processed. This often happens if the payment was cancelled or session expired.', { parse_mode: 'HTML' });
                } else {
                    bot.sendMessage(chatId, '❌ Verification failed. Please try again or contact support.');
                }
            }
        } else if (query.data === 'premium_help') {
            bot.answerCallbackQuery(query.id);
            bot.sendMessage(chatId, 'ℹ️ Premium gives you full access to job contacts, instant alerts, and advanced filters. Payments are processed securely via PayPal.');
        }
    });
};
