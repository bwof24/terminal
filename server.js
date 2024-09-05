const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const path = require('path');
const session = require('express-session');
const pam = require('authenticate-pam');
const fileUpload = require('express-fileupload');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware for file upload and session handling
app.use(fileUpload());
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));

// Serve the frontend
app.use(express.static(path.join(__dirname, 'public')));

// Authentication
app.use(express.urlencoded({ extended: false }));
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    pam.authenticate(username, password, (err) => {
        if (err) {
            res.status(401).send('Authentication failed');
        } else {
            req.session.username = username;
            res.redirect('/');
        }
    });
});

// WebSocket for terminal handling
wss.on('connection', (ws, req) => {
    const username = req.session && req.session.username;
    if (!username) {
        ws.close();
        return;
    }

    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env,
    });

    ptyProcess.on('data', (data) => ws.send(data));

    ws.on('message', (msg) => ptyProcess.write(msg));
    ws.on('close', () => ptyProcess.kill());
});

// File Upload Route
app.post('/upload', (req, res) => {
    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    const file = req.files.file;
    const uploadPath = path.join(__dirname, 'uploads', file.name);

    file.mv(uploadPath, (err) => {
        if (err) return res.status(500).send(err);
        res.send('File uploaded!');
    });
});

// File Download Route
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    res.download(filePath);
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
