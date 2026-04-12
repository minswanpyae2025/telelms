const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL || 'postgres://postgres:postgres@localhost:5432/lms',
  ssl: process.env.POSTGRES_URL ? { rejectUnauthorized: false } : false
});

async function createTables() {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, telegram_id BIGINT UNIQUE NOT NULL, first_name TEXT, last_name TEXT, username TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS roadmaps (id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT, icon TEXT, color TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS courses (id SERIAL PRIMARY KEY, roadmap_id INTEGER, title TEXT NOT NULL, description TEXT, price_mmk INTEGER NOT NULL, telegram_group_id TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(roadmap_id) REFERENCES roadmaps(id) ON DELETE SET NULL)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS modules (id SERIAL PRIMARY KEY, course_id INTEGER, title TEXT NOT NULL, order_index INTEGER DEFAULT 0, FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS lessons (id SERIAL PRIMARY KEY, module_id INTEGER, title TEXT NOT NULL, content TEXT, video_url TEXT, file_url TEXT, order_index INTEGER DEFAULT 0, FOREIGN KEY(module_id) REFERENCES modules(id) ON DELETE CASCADE)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS payment_methods (id SERIAL PRIMARY KEY, name TEXT NOT NULL, account_name TEXT, account_number TEXT, qr_image_url TEXT, instructions TEXT)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS bookmarks (id SERIAL PRIMARY KEY, user_id INTEGER, course_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE, UNIQUE(user_id, course_id))`);
        await pool.query(`CREATE TABLE IF NOT EXISTS progress (id SERIAL PRIMARY KEY, user_id INTEGER, lesson_id INTEGER, completed BOOLEAN DEFAULT FALSE, completed_at TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE, UNIQUE(user_id, lesson_id))`);
        await pool.query(`CREATE TABLE IF NOT EXISTS announcements (id SERIAL PRIMARY KEY, course_id INTEGER, title TEXT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE)`);
        await pool.query(`CREATE TABLE IF NOT EXISTS reviews (id SERIAL PRIMARY KEY, user_id INTEGER, course_id INTEGER, rating INTEGER CHECK(rating >= 1 AND rating <= 5), comment TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE, UNIQUE(user_id, course_id))`);
        await pool.query(`CREATE TABLE IF NOT EXISTS payments (id SERIAL PRIMARY KEY, user_id INTEGER, course_id INTEGER, payment_method_id INTEGER, screenshot_url TEXT NOT NULL, status TEXT DEFAULT 'pending', admin_note TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE SET NULL, FOREIGN KEY(payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL)`);
    } catch (err) {
        console.error("Error creating tables:", err);
    }
}

createTables();

function convertQuery(sql) {
    let index = 1;
    return sql.replace(/\?/g, () => `$${index++}`);
}

const db = {
    run: async (sql, params = [], cb) => {
        if (typeof params === 'function') {
            cb = params;
            params = [];
        }
        try {
            const pgSql = convertQuery(sql);
            const res = await pool.query(pgSql, params);
            if (cb) cb.call({ lastID: res.rows && res.rows.length > 0 ? res.rows[0].id : null, changes: res.rowCount }, null);
        } catch (err) {
            if (cb) cb(err);
            else console.error(err);
        }
    },
    get: async (sql, params = [], cb) => {
        if (typeof params === 'function') {
            cb = params;
            params = [];
        }
        try {
            const pgSql = convertQuery(sql);
            const res = await pool.query(pgSql, params);
            if (cb) cb(null, res.rows[0]);
        } catch (err) {
            if (cb) cb(err, null);
        }
    },
    all: async (sql, params = [], cb) => {
        if (typeof params === 'function') {
            cb = params;
            params = [];
        }
        try {
            const pgSql = convertQuery(sql);
            const res = await pool.query(pgSql, params);
            if (cb) cb(null, res.rows);
        } catch (err) {
            if (cb) cb(err, null);
        }
    }
};

module.exports = db;
