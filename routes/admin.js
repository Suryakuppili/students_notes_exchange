const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');

// GET /api/admin/stats
router.get('/stats', requireAdmin, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const totalNotes = db.prepare('SELECT COUNT(*) as c FROM notes').get().c;
  const totalDownloads = db.prepare('SELECT SUM(download_count) as c FROM notes').get().c || 0;
  const totalRatings = db.prepare('SELECT COUNT(*) as c FROM ratings').get().c;
  const flaggedNotes = db.prepare('SELECT COUNT(*) as c FROM notes WHERE is_flagged = 1').get().c;
  const todayDownloads = db.prepare("SELECT COUNT(*) as c FROM downloads WHERE date(downloaded_at) = date('now')").get().c;
  const todayUploads = db.prepare("SELECT COUNT(*) as c FROM notes WHERE date(created_at) = date('now')").get().c;
  const todayRegistrations = db.prepare("SELECT COUNT(*) as c FROM users WHERE date(created_at) = date('now')").get().c;

  const topSubjects = db.prepare('SELECT subject, COUNT(*) as count FROM notes GROUP BY subject ORDER BY count DESC LIMIT 5').all();
  const recentActivity = db.prepare(`
    SELECT 'upload' as type, n.title as detail, u.name as user_name, n.created_at as time
    FROM notes n JOIN users u ON n.uploader_id = u.id
    UNION ALL
    SELECT 'download' as type, n.title as detail, COALESCE(u.name, 'Guest') as user_name, d.downloaded_at as time
    FROM downloads d JOIN notes n ON d.note_id = n.id LEFT JOIN users u ON d.user_id = u.id
    ORDER BY time DESC LIMIT 10
  `).all();

  res.json({ totalUsers, totalNotes, totalDownloads, totalRatings, flaggedNotes, todayDownloads, todayUploads, todayRegistrations, topSubjects, recentActivity });
});

// GET /api/admin/users
router.get('/users', requireAdmin, (req, res) => {
  const { page = 1, limit = 20, q = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const users = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.university, u.avatar_color, u.created_at,
           COUNT(n.id) as note_count
    FROM users u LEFT JOIN notes n ON u.id = n.uploader_id
    WHERE u.name LIKE ? OR u.email LIKE ?
    GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?
  `).all(`%${q}%`, `%${q}%`, parseInt(limit), offset);

  const total = db.prepare('SELECT COUNT(*) as c FROM users WHERE name LIKE ? OR email LIKE ?').get(`%${q}%`, `%${q}%`).c;
  res.json({ users, total });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', requireAdmin, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own admin account' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted' });
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ message: 'Role updated' });
});

// GET /api/admin/notes
router.get('/notes', requireAdmin, (req, res) => {
  const { page = 1, limit = 20, flagged = '' } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const flagFilter = flagged === 'true' ? 'WHERE n.is_flagged = 1' : '';

  const notes = db.prepare(`
    SELECT n.*, u.name as uploader_name,
           (SELECT COUNT(*) FROM flags WHERE note_id = n.id) as flag_count
    FROM notes n JOIN users u ON n.uploader_id = u.id
    ${flagFilter}
    ORDER BY n.created_at DESC LIMIT ? OFFSET ?
  `).all(parseInt(limit), offset);

  const total = db.prepare(`SELECT COUNT(*) as c FROM notes n ${flagFilter}`).get().c;
  res.json({ notes, total });
});

// DELETE /api/admin/notes/:id
router.delete('/notes/:id', requireAdmin, (req, res) => {
  const note = db.prepare('SELECT file_path FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const filePath = path.join(__dirname, '../uploads', note.file_path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM notes WHERE id = ?').run(req.params.id);
  res.json({ message: 'Note deleted' });
});

// PUT /api/admin/notes/:id/unflag
router.put('/notes/:id/unflag', requireAdmin, (req, res) => {
  db.prepare('UPDATE notes SET is_flagged = 0 WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM flags WHERE note_id = ?').run(req.params.id);
  res.json({ message: 'Note unflagged' });
});

module.exports = router;
