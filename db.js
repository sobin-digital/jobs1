const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const jobs = [
    { id: 1, title: 'Web Developer', category: 'IT & Tech', location: 'Dubai', exp: 'Experienced', isPremium: false, contact: 'hr@techuae.com' },
    { id: 2, title: 'Sales Executive', category: 'Sales & Marketing', location: 'Abu Dhabi', exp: 'Fresher', isPremium: false, contact: 'sales@dxbjobs.com' },
    { id: 3, title: 'Nurse', category: 'Hospitality', location: 'Sharjah', exp: 'Experienced', isPremium: true, contact: 'premium-contact@hospital.com' },
    { id: 4, title: 'Delivery Driver', category: 'Drivers & Helpers', location: 'Dubai', exp: 'Fresher', isPremium: false, contact: '+971501234567' },
];

async function initDB() {
    const connection = await pool.getConnection();
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL
            )
        `);

        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_categories (
                telegram_id BIGINT,
                category_id INT,
                PRIMARY KEY (telegram_id, category_id),
                FOREIGN KEY (telegram_id) REFERENCES users(telegram_id) ON DELETE CASCADE,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
            )
        `);

        // Insert initial categories if empty
        const [catRows] = await connection.query('SELECT COUNT(*) as count FROM categories');
        if (catRows[0].count === 0) {
            const initialCategories = ['IT & Tech', 'Sales & Marketing', 'Hospitality', 'Drivers & Helpers', 'Finance & Accounting', 'Construction'];
            for (const cat of initialCategories) {
                await connection.query('INSERT IGNORE INTO categories (name) VALUES (?)', [cat]);
            }
        }

        console.log('Database initialized');
    } catch (err) {
        console.error('Error initializing database:', err);
    } finally {
        connection.release();
    }
}

initDB();

module.exports = {
    pool,
    allJobs: jobs,
    getJobs: (premiumOnly = false) => jobs.filter(j => !premiumOnly || j.isPremium),
    getUser: async (telegramId) => {
        const [rows] = await pool.execute('SELECT * FROM users WHERE telegram_id = ?', [telegramId]);
        return rows[0] || { is_premium: false };
    },
    saveUser: async (user) => {
        const { id, username = null, first_name = null, last_name = null } = user;
        try {
            const [rows] = await pool.execute('SELECT * FROM users WHERE telegram_id = ?', [id]);

            if (rows.length === 0) {
                const trialExpiry = new Date();
                trialExpiry.setDate(trialExpiry.getDate() + 1);

                await pool.execute(
                    'INSERT INTO users (telegram_id, username, first_name, last_name, is_premium, trial_used, premium_expiry) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [id, username, first_name, last_name, true, true, trialExpiry]
                );
                return { isNew: true, trialExpiry };
            } else {
                await pool.execute(
                    'UPDATE users SET username = ?, first_name = ?, last_name = ? WHERE telegram_id = ?',
                    [username, first_name, last_name, id]
                );
                return { isNew: false, userData: rows[0] };
            }
        } catch (err) {
            console.error('Save user error:', err);
            return { isNew: false };
        }
    },
    setPremium: async (telegramId, days, months = 1) => {
        const [rows] = await pool.execute('SELECT premium_expiry FROM users WHERE telegram_id = ?', [telegramId]);
        let expiry = rows[0]?.premium_expiry ? new Date(rows[0].premium_expiry) : new Date();

        if (expiry < new Date()) expiry = new Date();
        expiry.setDate(expiry.getDate() + (days || 30));

        await pool.execute(
            'UPDATE users SET is_premium = TRUE, premium_expiry = ?, premium_plan = ? WHERE telegram_id = ?',
            [expiry, months, telegramId]
        );
    },
    checkPremium: async (telegramId) => {
        try {
            const [rows] = await pool.execute('SELECT is_premium, premium_expiry FROM users WHERE telegram_id = ?', [telegramId]);
            if (rows.length === 0) return false;

            const { is_premium, premium_expiry } = rows[0];
            if (!is_premium) return false;

            const now = new Date();
            if (premium_expiry && new Date(premium_expiry) < now) {
                await pool.execute('UPDATE users SET is_premium = FALSE WHERE telegram_id = ?', [telegramId]);
                return false;
            }
            return true;
        } catch (err) {
            console.error('Check premium error:', err);
            return false;
        }
    },
    getPremiumUsers: async () => {
        try {
            const [rows] = await pool.execute('SELECT telegram_id FROM users WHERE is_premium = TRUE');
            return rows;
        } catch (err) {
            console.error('Get premium users error:', err);
            return [];
        }
    },
    getAllUsers: async () => {
        try {
            const [rows] = await pool.execute('SELECT telegram_id FROM users');
            return rows;
        } catch (err) {
            console.error('Get all users error:', err);
            return [];
        }
    },
    getCategories: async () => {
        const [rows] = await pool.execute('SELECT * FROM categories ORDER BY name ASC');
        return rows;
    },
    addCategory: async (name) => {
        await pool.execute('INSERT IGNORE INTO categories (name) VALUES (?)', [name]);
    },
    getUserCategories: async (telegramId) => {
        const [rows] = await pool.execute('SELECT category_id FROM user_categories WHERE telegram_id = ?', [telegramId]);
        return rows.map(r => r.category_id);
    },
    setUserCategory: async (telegramId, categoryId, append = false) => {
        if (!append) {
            await pool.execute('DELETE FROM user_categories WHERE telegram_id = ?', [telegramId]);
        }
        await pool.execute('INSERT IGNORE INTO user_categories (telegram_id, category_id) VALUES (?, ?)', [telegramId, categoryId]);
    },
    toggleUserCategory: async (telegramId, categoryId, isPremium) => {
        if (!isPremium) {
            // Free user: single category selection
            await pool.execute('DELETE FROM user_categories WHERE telegram_id = ?', [telegramId]);
            await pool.execute('INSERT INTO user_categories (telegram_id, category_id) VALUES (?, ?)', [telegramId, categoryId]);
        } else {
            // Premium user: multi category toggle
            const [rows] = await pool.execute('SELECT * FROM user_categories WHERE telegram_id = ? AND category_id = ?', [telegramId, categoryId]);
            if (rows.length > 0) {
                await pool.execute('DELETE FROM user_categories WHERE telegram_id = ? AND category_id = ?', [telegramId, categoryId]);
            } else {
                await pool.execute('INSERT INTO user_categories (telegram_id, category_id) VALUES (?, ?)', [telegramId, categoryId]);
            }
        }
    },
    getCategoryStats: async () => {
        const [rows] = await pool.execute(`
            SELECT c.name, COUNT(uc.telegram_id) as user_count
            FROM categories c
            LEFT JOIN user_categories uc ON c.id = uc.category_id
            GROUP BY c.id
        `);
        return rows;
    },
    getUsersByCategory: async (categoryId) => {
        const [rows] = await pool.execute('SELECT telegram_id FROM user_categories WHERE category_id = ?', [categoryId]);
        return rows;
    }
};

