const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const activeTerminals = {};

// Helper function to handle pty process data
function handlePtyData(ws, ptyProcess) {
    ptyProcess.on('data', (data) => {
        ws.send(JSON.stringify({ type: 'output', data }));
    });
}

// Create a new terminal session
function createTerminalSession(ws) {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env
    });

    const sessionId = Math.random().toString(36).substring(2);
    activeTerminals[sessionId] = ptyProcess;

    handlePtyData(ws, ptyProcess);

    ws.on('message', (message) => {
        const { type, data } = JSON.parse(message);
        if (type === 'input') {
            ptyProcess.write(data);
        } else if (type === 'command') {
            ptyProcess.write(`${data}\n`);
        } else if (type === 'session') {
            ws.send(JSON.stringify({ type: 'session', sessionId }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        ptyProcess.kill();
        delete activeTerminals[sessionId];
    });
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    console.log('New client connected');
    createTerminalSession(ws);
});

// Handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
    res.json({ filePath: `/uploads/${req.file.filename}` });
});

// Handle file download
app.get('/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join('uploads', filename);
    res.download(filePath);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
