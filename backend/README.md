# BeautifyAI Backend

Node.js + Express backend with SQLite database for BeautifyAI authentication.

## Folder Structure

```
Desktop/
├── beauty1/               ← Frontend (React + Vite)
└── beautifyai-backend/    ← Backend (Express + SQLite) ← YOU ARE HERE
```

## Setup & Run

### 1. Install dependencies
```bash
cd beautifyai-backend
npm install
```

### 2. Start the backend server
```bash
node index.js
```

The server runs on **http://localhost:3001**

## API Endpoints

| Method | Endpoint       | Description                        |
|--------|----------------|------------------------------------|
| GET    | /api/health    | Check if server is running         |
| POST   | /api/signup    | Register a new user                |
| POST   | /api/login     | Login with email + password        |

### POST /api/signup
```json
{ "name": "John Doe", "email": "john@example.com", "password": "mypassword123" }
```

### POST /api/login
```json
{ "email": "john@example.com", "password": "mypassword123" }
```

## Database

Users are stored in `users.db` (SQLite file, auto-created on first run).  
Passwords are hashed with **bcrypt** (12 rounds) — never stored in plaintext.

## Running Both Together

Open **two terminals**:

**Terminal 1 — Frontend:**
```bash
cd beauty1
npm run dev
```

**Terminal 2 — Backend:**
```bash
cd beautifyai-backend
node index.js
```
