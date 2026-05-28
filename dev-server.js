// Temporary local dev server - serves static files + API
require('dotenv').config();
const express = require('express');
const path = require('path');
const handler = require('./api/index.js');

const app = express();
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) return handler(req, res);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dev server running at http://localhost:${PORT}`));
