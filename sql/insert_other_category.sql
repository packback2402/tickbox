INSERT INTO categories (name) SELECT 'Khác' WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Khác');
