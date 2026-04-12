const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error(err.message);
    else createTables();
});

function createTables() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, telegram_id INTEGER UNIQUE NOT NULL, first_name TEXT, last_name TEXT, username TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS roadmaps (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, icon TEXT, color TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
        db.run(`CREATE TABLE IF NOT EXISTS courses (id INTEGER PRIMARY KEY AUTOINCREMENT, roadmap_id INTEGER, title TEXT NOT NULL, description TEXT, price_mmk INTEGER NOT NULL, telegram_group_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(roadmap_id) REFERENCES roadmaps(id))`);
        db.run(`CREATE TABLE IF NOT EXISTS modules (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER, title TEXT NOT NULL, order_index INTEGER DEFAULT 0, FOREIGN KEY(course_id) REFERENCES courses(id))`);
        db.run(`CREATE TABLE IF NOT EXISTS lessons (id INTEGER PRIMARY KEY AUTOINCREMENT, module_id INTEGER, title TEXT NOT NULL, content TEXT, video_url TEXT, file_url TEXT, order_index INTEGER DEFAULT 0, FOREIGN KEY(module_id) REFERENCES modules(id))`);
        db.run(`CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, account_name TEXT, account_number TEXT, qr_image_url TEXT, instructions TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS bookmarks (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, course_id INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(course_id) REFERENCES courses(id), UNIQUE(user_id, course_id))`);
        db.run(`CREATE TABLE IF NOT EXISTS progress (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, lesson_id INTEGER, completed BOOLEAN DEFAULT 0, completed_at DATETIME, FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(lesson_id) REFERENCES lessons(id), UNIQUE(user_id, lesson_id))`);
        db.run(`CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY AUTOINCREMENT, course_id INTEGER, title TEXT NOT NULL, content TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(course_id) REFERENCES courses(id))`);
        db.run(`CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, course_id INTEGER, rating INTEGER CHECK(rating >= 1 AND rating <= 5), comment TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(course_id) REFERENCES courses(id), UNIQUE(user_id, course_id))`);
        db.run(`CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, course_id INTEGER, payment_method_id INTEGER, screenshot_url TEXT NOT NULL, status TEXT DEFAULT 'pending', admin_note TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(course_id) REFERENCES courses(id), FOREIGN KEY(payment_method_id) REFERENCES payment_methods(id))`);
    });
}
module.exports = db;
