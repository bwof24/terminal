const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mime = require('mime-types');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from 'public' directory
app.use(express.static('public'));

// Use multer to handle file uploads, saving them to the user's $HOME directory
const upload = multer({
    dest: process.env.HOME
});

// WebSocket setup for terminal interaction
wss.on('connection', (ws) => {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME, // Set working directory to $HOME
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
});

// Handle file downloads from the $HOME directory
app.get('/download/:filename', (req, res) => {
    const filePath = path.join(process.env.HOME, req.params.filename);
    
    // Check if the file exists before attempting to download
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.status(404).send('File not found');
            return;
        }

        // Get the MIME type of the file
        const mimeType = mime.lookup(filePath) || 'application/octet-stream';

        // Set appropriate headers to handle download
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
        res.setHeader('Content-Type', mimeType);
        
        // Stream the file content to the client
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    });
});

// Handle file uploads to the $HOME directory
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
