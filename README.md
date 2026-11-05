# 📚 NotesHub — Student Notes Exchange Portal

A full-stack web app where students can upload, discover, rate, and download study notes.

## ✨ Features
- 📤 Drag & drop file uploads (PDF, DOCX, PPT, Images, TXT)
- 🔍 Search & filter notes by subject, type, and sort order
- ⭐ Star ratings & written reviews
- 🔖 Bookmark notes into personal collections
- 🚩 Flag inappropriate content
- 🛡️ Admin moderation dashboard
- 🌙 Dark glassmorphism UI, fully responsive

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up environment variables
```bash
cp .env.example .env
# Edit .env and set your values
```

### 4. Run the server
```bash
node server.js
```

Open **http://localhost:3067** in your browser.

## 🔑 Default Admin Login
Set via your `.env` file (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).

## 🗂️ Project Structure
```
├── db/              # SQLite database setup
├── middleware/      # JWT auth middleware
├── routes/          # Express API routes
├── public/
│   ├── css/         # Design system stylesheet
│   ├── js/          # Frontend API client, auth, nav
│   └── pages/       # HTML pages
├── uploads/         # Uploaded files (auto-created)
├── server.js        # App entry point
└── .env.example     # Environment variable template
```

## 🛠️ Tech Stack
- **Backend:** Node.js, Express.js
- **Database:** SQLite (better-sqlite3)
- **Auth:** JWT (jsonwebtoken + bcryptjs)
- **Uploads:** Multer
- **Frontend:** Vanilla HTML/CSS/JS
