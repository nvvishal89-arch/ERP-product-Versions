# Blueprint AI Pro 🛠️

**Blueprint AI Pro** is a high-performance engineering intelligence platform that leverages the Gemini API to transform product concepts and reference images into detailed technical blueprints, engineering specifications, and CAD-ready files.

## 🚀 Key Features

- **AI Synthesis**: Generate multi-angle perspective views from a single source image.
- **Engineering Analysis**: Automatically extract technical specifications, material requirements, and construction logic.
- **Technical Blueprints**: Generate detailed engineering drawings with precise dimensions.
- **CAD Export**: Export designs directly to `.dxf` format for use in AutoCAD, SolidWorks, and other professional software.
- **Google OAuth 2.0**: Secure multi-user authentication.
- **Cloud Sync**: Persistent project storage using a SQLite backend.
- **Mobile Ready**: Full PWA support and Capacitor integration for native Android (.APK) deployment.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS, Motion (Framer Motion).
- **Backend**: Node.js, Express.
- **Database**: SQLite (via `better-sqlite3`).
- **AI Engine**: Google Gemini API (`@google/genai`).
- **Native Mobile**: Capacitor.

## ⚙️ Setup & Installation

### 1. Environment Variables
Create a `.env` file in the root directory and configure the following:

```env
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SESSION_SECRET=your_random_session_secret
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Build for Production
```bash
npm run build
```

## 📱 Mobile Deployment (Android APK)

This project is pre-configured with Capacitor to run as a native Android app.

1. **Sync the project**:
   ```bash
   npm run android:sync
   ```
2. **Open in Android Studio**:
   ```bash
   npm run android:open
   ```
3. **Build APK**:
   In Android Studio, go to `Build > Build Bundle(s) / APK(s) > Build APK(s)`.

## 📖 Usage Guide

1. **Sign In**: Authenticate using your Google account.
2. **Initialize Project**: Click "New Project" and upload a reference image.
3. **Generate Perspectives**: Use the "Start Generation" tool to create alternate views.
4. **Analyze Specs**: Run the "Engineering Analysis" to extract dimensions and materials.
5. **Generate Blueprint**: Create the technical drawing based on the analyzed specs.
6. **Export**: Download the final blueprint as an image or export the CAD (.dxf) file for professional use.

---

*Crafted with precision for the next generation of engineers.*
