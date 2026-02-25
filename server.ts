import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("erp.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    image_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS product_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    view_type TEXT,
    image_url TEXT,
    source TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/products", (req, res) => {
    const products = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
    res.json(products);
  });

  app.post("/api/products", (req, res) => {
    const { name, image_data } = req.body;
    const info = db.prepare("INSERT INTO products (name, image_data) VALUES (?, ?)").run(name, image_data);
    res.json({ id: info.lastInsertRowid, name, image_data });
  });

  app.get("/api/products/:id/views", (req, res) => {
    const views = db.prepare("SELECT * FROM product_views WHERE product_id = ?").all(req.params.id);
    res.json(views);
  });

  app.post("/api/products/:id/views", (req, res) => {
    const { view_type, image_url, source } = req.body;
    const info = db.prepare("INSERT INTO product_views (product_id, view_type, image_url, source) VALUES (?, ?, ?, ?)").run(req.params.id, view_type, image_url, source);
    res.json({ id: info.lastInsertRowid, view_type, image_url, source });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
