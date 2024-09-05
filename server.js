const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

wss.on('connection', (ws) => {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

    let ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env
    });

    ptyProcess.on('data', (data) => {
        ws.send(data);
    });

    ws.on('message', (msg) => {
        ptyProcess.write(msg);
    });

    ws.on('close', () => {
        ptyProcess.kill();
    });

    // For starting a new session
    ws.on('new-session', () => {
        ptyProcess.kill();
        ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: process.env.HOME,
            env: process.env
        });
    });
});

// File download endpoint
app.get('/download/:filename', (req, res) => {
    const file = path.join(__dirname, 'uploads', req.params.filename);
    res.download(file);
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    res.send('File uploaded successfully');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
