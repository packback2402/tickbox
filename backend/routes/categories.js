const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const allCategories = await db.query("SELECT * FROM categories ORDER BY id ASC");
    res.status(200).json(allCategories.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// GET /api/categories/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const category = await db.query(
      "SELECT * FROM categories WHERE id = $1",
      [id]
    );
    if (category.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy danh mục" });
    }
    res.status(200).json(category.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// POST /api/categories
router.post('/', auth, admin, async (req, res) => {
  try {
    const { name } = req.body;
    const newCategory = await db.query(
      "INSERT INTO categories (name) VALUES ($1) RETURNING *",
      [name]
    );
    res.status(201).json(newCategory.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// PUT /api/categories/:id
router.put('/:id', auth, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updatedCategory = await db.query(
      "UPDATE categories SET name = $1 WHERE id = $2 RETURNING *",
      [name, id]
    );
    if (updatedCategory.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy danh mục" });
    }
    res.status(200).json(updatedCategory.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

// DELETE /api/categories/:id
router.delete('/:id', auth, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const deleteOp = await db.query(
      "DELETE FROM categories WHERE id = $1 RETURNING *",
      [id]
    );
    if (deleteOp.rows.length === 0) {
      return res.status(404).json({ msg: "Không tìm thấy danh mục" });
    }
    res.status(200).json({ msg: "Danh mục đã được xóa" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server");
  }
});

module.exports = router;
