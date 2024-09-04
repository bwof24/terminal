const WebSocket = require('ws');
const express = require('express');
const pty = require('pty.js');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const port = 8080;

// Serve static files (frontend)
app.use(express.static('public'));

// File upload setup
const upload = multer({ dest: 'uploads/' });
app.post('/upload', upload.single('file'), (req, res) => {
    res.send('File uploaded successfully');
});

// Download file
app.get('/download/:filename', (req, res) => {
    const file = path.join(__dirname, 'uploads', req.params.filename);
    res.download(file);
});

const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    const terminal = pty.spawn('bash', [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env
    });

    terminal.on('data', data => {
        ws.send(data);
    });

    ws.on('message', message => {
        terminal.write(message);
    });

    ws.on('close', () => {
        terminal.end();
    });
});
