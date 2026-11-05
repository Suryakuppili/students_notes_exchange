const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

// GET /api/users/:id — public profile
router.get('/:id', (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, university, bio, avatar_color, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const noteCount = db.prepare('SELECT COUNT(*) as c FROM notes WHERE uploader_id = ? AND is_flagged = 0').get(user.id).c;
  const totalDownloads = db.prepare('SELECT SUM(download_count) as c FROM notes WHERE uploader_id = ?').get(user.id).c || 0;
  const avgRating = db.prepare('SELECT AVG(avg_rating) as c FROM notes WHERE uploader_id = ? AND rating_count > 0').get(user.id).c;

  res.json({ user, stats: { noteCount, totalDownloads, avgRating: avgRating ? parseFloat(avgRating.toFixed(1)) : 0 } });
});

// GET /api/users/:id/notes — user's uploaded notes
router.get('/:id/notes', (req, res) => {
  const { page = 1, limit = 12 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const total = db.prepare('SELECT COUNT(*) as c FROM notes WHERE uploader_id = ? AND is_flagged = 0').get(req.params.id).c;
  const notes = db.prepare(`
    SELECT n.*, u.name as uploader_name, u.avatar_color as uploader_color
    FROM notes n JOIN users u ON n.uploader_id = u.id
    WHERE n.uploader_id = ? AND n.is_flagged = 0
    ORDER BY n.created_at DESC LIMIT ? OFFSET ?
  `).all(req.params.id, parseInt(limit), offset);

  res.json({ notes: notes.map(n => ({ ...n, tags: n.tags ? n.tags.split(',').map(t => t.trim()).filter(Boolean) : [] })), total });
});

// GET /api/users/me/downloads — my download history (auth required)
router.get('/me/downloads', authenticate, (req, res) => {
  const downloads = db.prepare(`
    SELECT d.*, n.title, n.subject, n.file_type, n.file_name, u.name as uploader_name
    FROM downloads d
    JOIN notes n ON d.note_id = n.id
    JOIN users u ON n.uploader_id = u.id
    WHERE d.user_id = ?
    ORDER BY d.downloaded_at DESC LIMIT 50
  `).all(req.user.id);
  res.json({ downloads });
});

module.exports = router;
