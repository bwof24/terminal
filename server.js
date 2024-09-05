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

// Serve static files from 'public' directory
app.use(express.static('public'));

// Use multer to handle file uploads, saving them to the user's $HOME directory
const upload = multer({
    dest: process.env.HOME
});

wss.on('connection', (ws) => {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

    // Start a new pty process (terminal session)
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME, // Set working directory to $HOME
        env: process.env
    });

    // Send data from pty process to the WebSocket (client)
    ptyProcess.on('data', (data) => {
        ws.send(data);
    });

    // Send data from WebSocket (client) to the pty process
    ws.on('message', (msg) => {
        ptyProcess.write(msg);
    });

    ws.on('close', () => {
        ptyProcess.kill();
    });
});

// Endpoint to handle file downloads
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(process.env.HOME, req.params.filename);
    res.download(filePath, req.params.filename, (err) => {
        if (err) {
            console.error(err);
            res.status(404).send('File not found');
        }
    });
});

// Endpoint to handle file uploads
app.post('/upload', upload.single('file'), (req, res) => {
    const oldPath = req.file.path;
    const newPath = path.join(process.env.HOME, req.file.originalname);

    fs.rename(oldPath, newPath, (err) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error moving file');
        } else {
            res.send('File uploaded successfully');
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
