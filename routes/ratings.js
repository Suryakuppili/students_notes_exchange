const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

// GET /api/ratings/notes/:id — get ratings for a note
router.get('/notes/:id', (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const ratings = db.prepare(`
    SELECT r.*, u.name as reviewer_name, u.avatar_color as reviewer_color
    FROM ratings r JOIN users u ON r.user_id = u.id
    WHERE r.note_id = ?
    ORDER BY r.created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.params.id, parseInt(limit), offset);

  const total = db.prepare('SELECT COUNT(*) as c FROM ratings WHERE note_id = ?').get(req.params.id).c;
  const distribution = db.prepare(`
    SELECT stars, COUNT(*) as count FROM ratings WHERE note_id = ? GROUP BY stars
  `).all(req.params.id);

  res.json({ ratings, total, distribution });
});

// POST /api/ratings/notes/:id — add or update rating
router.post('/notes/:id', authenticate, (req, res) => {
  const { stars, review } = req.body;
  if (!stars || stars < 1 || stars > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5 stars' });
  }

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.uploader_id === req.user.id) {
    return res.status(400).json({ error: 'You cannot rate your own note' });
  }

  // Upsert rating
  db.prepare(`
    INSERT INTO ratings (note_id, user_id, stars, review)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(note_id, user_id) DO UPDATE SET stars = excluded.stars, review = excluded.review, created_at = CURRENT_TIMESTAMP
  `).run(note.id, req.user.id, parseInt(stars), review || '');

  // Recalculate avg rating
  const stats = db.prepare('SELECT AVG(stars) as avg, COUNT(*) as count FROM ratings WHERE note_id = ?').get(note.id);
  db.prepare('UPDATE notes SET avg_rating = ?, rating_count = ? WHERE id = ?')
    .run(parseFloat(stats.avg.toFixed(2)), stats.count, note.id);

  const rating = db.prepare('SELECT * FROM ratings WHERE note_id = ? AND user_id = ?').get(note.id, req.user.id);
  res.json({ rating, avgRating: parseFloat(stats.avg.toFixed(2)), ratingCount: stats.count });
});

// DELETE /api/ratings/notes/:id — remove my rating
router.delete('/notes/:id', authenticate, (req, res) => {
  const rating = db.prepare('SELECT * FROM ratings WHERE note_id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!rating) return res.status(404).json({ error: 'Rating not found' });

  db.prepare('DELETE FROM ratings WHERE note_id = ? AND user_id = ?').run(req.params.id, req.user.id);

  const stats = db.prepare('SELECT AVG(stars) as avg, COUNT(*) as count FROM ratings WHERE note_id = ?').get(req.params.id);
  db.prepare('UPDATE notes SET avg_rating = ?, rating_count = ? WHERE id = ?')
    .run(stats.avg ? parseFloat(stats.avg.toFixed(2)) : 0, stats.count, req.params.id);

  res.json({ message: 'Rating removed' });
});

module.exports = router;
