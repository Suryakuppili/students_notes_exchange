const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authenticate, optionalAuth } = require('../middleware/auth');

// File upload configuration
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'text/plain',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
];

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Supported: PDF, DOCX, PPT, images, TXT'));
    }
  }
});

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science',
  'Engineering', 'Economics', 'History', 'Literature', 'Psychology',
  'Law', 'Medicine', 'Business', 'Arts', 'Other'];

// Helper: format note with uploader info
const formatNote = (note) => {
  if (!note) return null;
  return {
    ...note,
    tags: note.tags ? note.tags.split(',').map(t => t.trim()).filter(Boolean) : []
  };
};

// GET /api/notes — search, filter, paginate
router.get('/', optionalAuth, (req, res) => {
  const {
    q = '', subject = '', course = '', university = '',
    type = '', sort = 'newest', page = 1, limit = 12
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = ['n.is_flagged = 0'];
  const params = [];

  if (q) {
    conditions.push(`(n.title LIKE ? OR n.description LIKE ? OR n.tags LIKE ? OR n.course LIKE ?)`);
    const qLike = `%${q}%`;
    params.push(qLike, qLike, qLike, qLike);
  }
  if (subject) { conditions.push('n.subject = ?'); params.push(subject); }
  if (course) { conditions.push('n.course LIKE ?'); params.push(`%${course}%`); }
  if (university) { conditions.push('n.university LIKE ?'); params.push(`%${university}%`); }
  if (type) { conditions.push('n.file_type LIKE ?'); params.push(`%${type}%`); }

  const sortMap = {
    newest: 'n.created_at DESC',
    oldest: 'n.created_at ASC',
    most_downloaded: 'n.download_count DESC',
    top_rated: 'n.avg_rating DESC',
    most_reviewed: 'n.rating_count DESC'
  };
  const orderBy = sortMap[sort] || sortMap.newest;

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM notes n ${whereClause}
  `).get(...params).count;

  const notes = db.prepare(`
    SELECT n.*, u.name as uploader_name, u.avatar_color as uploader_color
    FROM notes n
    JOIN users u ON n.uploader_id = u.id
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({
    notes: notes.map(formatNote),
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / parseInt(limit)),
    subjects: SUBJECTS
  });
});

// GET /api/notes/subjects — get all subjects with counts
router.get('/subjects', (req, res) => {
  const rows = db.prepare(`
    SELECT subject, COUNT(*) as count FROM notes
    WHERE is_flagged = 0
    GROUP BY subject ORDER BY count DESC
  `).all();
  res.json({ subjects: rows });
});

// GET /api/notes/stats — site-wide statistics
router.get('/stats', (req, res) => {
  const totalNotes = db.prepare('SELECT COUNT(*) as c FROM notes WHERE is_flagged=0').get().c;
  const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const totalDownloads = db.prepare('SELECT SUM(download_count) as c FROM notes').get().c || 0;
  const totalSubjects = db.prepare('SELECT COUNT(DISTINCT subject) as c FROM notes WHERE is_flagged=0').get().c;
  res.json({ totalNotes, totalUsers, totalDownloads, totalSubjects });
});

// GET /api/notes/:id — single note
router.get('/:id', optionalAuth, (req, res) => {
  const note = db.prepare(`
    SELECT n.*, u.name as uploader_name, u.avatar_color as uploader_color, u.university as uploader_university
    FROM notes n
    JOIN users u ON n.uploader_id = u.id
    WHERE n.id = ?
  `).get(req.params.id);

  if (!note) return res.status(404).json({ error: 'Note not found' });

  // Get user's rating if logged in
  let userRating = null;
  if (req.user) {
    userRating = db.prepare('SELECT * FROM ratings WHERE note_id = ? AND user_id = ?').get(note.id, req.user.id);
  }

  // Check if bookmarked
  let isBookmarked = false;
  if (req.user) {
    const bookmark = db.prepare(`
      SELECT cn.collection_id FROM collection_notes cn
      JOIN collections c ON cn.collection_id = c.id
      WHERE cn.note_id = ? AND c.user_id = ?
      LIMIT 1
    `).get(note.id, req.user.id);
    isBookmarked = !!bookmark;
  }

  res.json({ note: formatNote(note), userRating, isBookmarked });
});

// POST /api/notes — upload note
router.post('/', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'File is required' });

  const { title, description, subject, course, university, tags } = req.body;
  if (!title || !subject) return res.status(400).json({ error: 'Title and subject are required' });

  const result = db.prepare(`
    INSERT INTO notes (title, description, subject, course, university, tags, file_path, file_name, file_type, file_size, uploader_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(), description || '', subject, course || '',
    university || req.user.university || '',
    tags || '', req.file.filename, req.file.originalname,
    req.file.mimetype, req.file.size, req.user.id
  );

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ note: formatNote(note) });
});

// PUT /api/notes/:id — update note
router.put('/:id', authenticate, (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.uploader_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const { title, description, subject, course, university, tags } = req.body;
  db.prepare(`
    UPDATE notes SET title=?, description=?, subject=?, course=?, university=?, tags=?
    WHERE id=?
  `).run(
    title || note.title, description !== undefined ? description : note.description,
    subject || note.subject, course !== undefined ? course : note.course,
    university !== undefined ? university : note.university,
    tags !== undefined ? tags : note.tags, note.id
  );

  const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(note.id);
  res.json({ note: formatNote(updated) });
});

// DELETE /api/notes/:id
router.delete('/:id', authenticate, (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  if (note.uploader_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  // Delete file from disk
  const filePath = path.join(UPLOADS_DIR, note.file_path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM notes WHERE id = ?').run(note.id);
  res.json({ message: 'Note deleted successfully' });
});

// GET /api/notes/:id/download
router.get('/:id/download', optionalAuth, (req, res) => {
  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const filePath = path.join(UPLOADS_DIR, note.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on server' });

  // Track download
  db.prepare('UPDATE notes SET download_count = download_count + 1 WHERE id = ?').run(note.id);
  db.prepare('INSERT INTO downloads (note_id, user_id) VALUES (?, ?)').run(note.id, req.user?.id || null);

  res.download(filePath, note.file_name);
});

// POST /api/notes/:id/flag
router.post('/:id/flag', authenticate, (req, res) => {
  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  const { reason } = req.body;
  try {
    db.prepare('INSERT INTO flags (note_id, user_id, reason) VALUES (?, ?, ?)').run(note.id, req.user.id, reason || '');
    // Auto-flag note if >= 3 flags
    const flagCount = db.prepare('SELECT COUNT(*) as c FROM flags WHERE note_id = ?').get(note.id).c;
    if (flagCount >= 3) {
      db.prepare('UPDATE notes SET is_flagged = 1 WHERE id = ?').run(note.id);
    }
    res.json({ message: 'Note flagged for review' });
  } catch {
    res.status(409).json({ error: 'You have already flagged this note' });
  }
});

module.exports = router;
