const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { authenticate } = require('../middleware/auth');

// GET /api/collections — my collections
router.get('/', authenticate, (req, res) => {
  const collections = db.prepare(`
    SELECT c.*, COUNT(cn.note_id) as note_count
    FROM collections c
    LEFT JOIN collection_notes cn ON c.id = cn.collection_id
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `).all(req.user.id);
  res.json({ collections });
});

// POST /api/collections — create collection
router.post('/', authenticate, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Collection name is required' });

  const result = db.prepare('INSERT INTO collections (user_id, name, description) VALUES (?, ?, ?)').run(req.user.id, name.trim(), description || '');
  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ collection });
});

// GET /api/collections/:id/notes — get notes in collection
router.get('/:id/notes', authenticate, (req, res) => {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!collection) return res.status(404).json({ error: 'Collection not found' });

  const notes = db.prepare(`
    SELECT n.*, u.name as uploader_name, u.avatar_color as uploader_color, cn.added_at
    FROM collection_notes cn
    JOIN notes n ON cn.note_id = n.id
    JOIN users u ON n.uploader_id = u.id
    WHERE cn.collection_id = ?
    ORDER BY cn.added_at DESC
  `).all(req.params.id);

  res.json({ collection, notes: notes.map(n => ({ ...n, tags: n.tags ? n.tags.split(',').map(t => t.trim()).filter(Boolean) : [] })) });
});

// POST /api/collections/:id/notes — add note to collection
router.post('/:id/notes', authenticate, (req, res) => {
  const { noteId } = req.body;
  if (!noteId) return res.status(400).json({ error: 'noteId is required' });

  const collection = db.prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!collection) return res.status(404).json({ error: 'Collection not found' });

  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(noteId);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  try {
    db.prepare('INSERT INTO collection_notes (collection_id, note_id) VALUES (?, ?)').run(req.params.id, noteId);
    res.json({ message: 'Note added to collection' });
  } catch {
    res.status(409).json({ error: 'Note already in collection' });
  }
});

// DELETE /api/collections/:id/notes/:noteId — remove note from collection
router.delete('/:id/notes/:noteId', authenticate, (req, res) => {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!collection) return res.status(404).json({ error: 'Collection not found' });

  db.prepare('DELETE FROM collection_notes WHERE collection_id = ? AND note_id = ?').run(req.params.id, req.params.noteId);
  res.json({ message: 'Note removed from collection' });
});

// PUT /api/collections/:id — update collection
router.put('/:id', authenticate, (req, res) => {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!collection) return res.status(404).json({ error: 'Collection not found' });

  const { name, description } = req.body;
  db.prepare('UPDATE collections SET name = ?, description = ? WHERE id = ?').run(name || collection.name, description !== undefined ? description : collection.description, req.params.id);
  const updated = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
  res.json({ collection: updated });
});

// DELETE /api/collections/:id — delete collection
router.delete('/:id', authenticate, (req, res) => {
  const collection = db.prepare('SELECT * FROM collections WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!collection) return res.status(404).json({ error: 'Collection not found' });

  db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id);
  res.json({ message: 'Collection deleted' });
});

// Quick bookmark: POST /api/collections/bookmark/:noteId — add to default "Saved" collection
router.post('/bookmark/:noteId', authenticate, (req, res) => {
  const note = db.prepare('SELECT id FROM notes WHERE id = ?').get(req.params.noteId);
  if (!note) return res.status(404).json({ error: 'Note not found' });

  // Find or create "Saved Notes" collection
  let saved = db.prepare('SELECT id FROM collections WHERE user_id = ? AND name = ?').get(req.user.id, 'Saved Notes');
  if (!saved) {
    const r = db.prepare('INSERT INTO collections (user_id, name, description) VALUES (?, ?, ?)').run(req.user.id, 'Saved Notes', 'My saved notes');
    saved = { id: r.lastInsertRowid };
  }

  try {
    db.prepare('INSERT INTO collection_notes (collection_id, note_id) VALUES (?, ?)').run(saved.id, req.params.noteId);
    res.json({ message: 'Note bookmarked', collectionId: saved.id });
  } catch {
    // Already bookmarked, remove it (toggle)
    db.prepare('DELETE FROM collection_notes WHERE collection_id = ? AND note_id = ?').run(saved.id, req.params.noteId);
    res.json({ message: 'Note unbookmarked', collectionId: saved.id });
  }
});

module.exports = router;
