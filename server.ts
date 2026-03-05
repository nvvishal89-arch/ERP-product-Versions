import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import cors from "cors";
import dotenv from "dotenv";
import session from "express-session";
import { OAuth2Client } from "google-auth-library";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("erp.db");

// Initialize DB with multi-user support
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    name TEXT NOT NULL,
    image_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
  
  CREATE TABLE IF NOT EXISTS product_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    view_type TEXT,
    image_url TEXT,
    source TEXT,
    metadata TEXT,
    FOREIGN KEY(product_id) REFERENCES products(id)
  );
`);

// Google OAuth Client
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Session configuration for iframe context
  app.use(session({
    secret: process.env.SESSION_SECRET || "blueprint-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      sameSite: 'none',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(express.json({ limit: '50mb' }));

  // Auth Routes
  app.get("/api/auth/google/url", (req, res) => {
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/callback`;
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
      redirect_uri: redirectUri
    });
    res.json({ url });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    const redirectUri = `${req.protocol}://${req.get('host')}/auth/callback`;
    
    try {
      const { tokens } = await oauth2Client.getToken({
        code: code as string,
        redirect_uri: redirectUri
      });
      oauth2Client.setCredentials(tokens);

      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` }
      });
      const userInfo = await userInfoResponse.json();

      // Upsert user
      db.prepare(`
        INSERT INTO users (id, email, name, picture) 
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
          name=excluded.name, 
          picture=excluded.picture
      `).run(userInfo.sub, userInfo.email, userInfo.name, userInfo.picture);

      // Set session
      (req.session as any).userId = userInfo.sub;
      (req.session as any).user = userInfo;

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. Closing window...</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("OAuth Error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  app.get("/api/auth/me", (req, res) => {
    if ((req.session as any).userId) {
      res.json({ user: (req.session as any).user });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // Protected API Routes
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!(req.session as any).userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  app.get("/api/products", requireAuth, (req, res) => {
    const userId = (req.session as any).userId;
    const products = db.prepare("SELECT * FROM products WHERE user_id = ? ORDER BY created_at DESC").all(userId);
    res.json(products);
  });

  app.post("/api/products", requireAuth, (req, res) => {
    const userId = (req.session as any).userId;
    const { name, image_data } = req.body;
    const info = db.prepare("INSERT INTO products (user_id, name, image_data) VALUES (?, ?, ?)").run(userId, name, image_data);
    res.json({ id: info.lastInsertRowid, name, image_data });
  });

  app.get("/api/products/:id/views", requireAuth, (req, res) => {
    const userId = (req.session as any).userId;
    // Verify ownership
    const product = db.prepare("SELECT id FROM products WHERE id = ? AND user_id = ?").get(req.params.id, userId);
    if (!product) return res.status(403).json({ error: "Forbidden" });

    const views = db.prepare("SELECT * FROM product_views WHERE product_id = ? ORDER BY id DESC").all(req.params.id);
    res.json(views);
  });

  app.post("/api/products/:id/views", requireAuth, (req, res) => {
    const userId = (req.session as any).userId;
    // Verify ownership
    const product = db.prepare("SELECT id FROM products WHERE id = ? AND user_id = ?").get(req.params.id, userId);
    if (!product) return res.status(403).json({ error: "Forbidden" });

    const { view_type, image_url, source, metadata } = req.body;
    const info = db.prepare("INSERT INTO product_views (product_id, view_type, image_url, source, metadata) VALUES (?, ?, ?, ?, ?)").run(req.params.id, view_type, image_url, source, metadata);
    res.json({ id: info.lastInsertRowid, view_type, image_url, source, metadata });
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
