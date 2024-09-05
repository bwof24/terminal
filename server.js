const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer'); // For file upload

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Multer setup for handling file uploads
const upload = multer({ dest: 'uploads/' });

// Authentication middleware for checking credentials
let authenticatedUsers = {}; // Track authenticated users

// WebSocket connection handling
wss.on('connection', (ws) => {
    let authenticated = false;
    let username = '';
    
    ws.send('Authentication required!\nEnter username: ');

    ws.on('message', (msg) => {
        if (!authenticated) {
            const input = msg.trim();
            if (!username) {
                // First step: asking for username
                username = input;
                ws.send(`Password for ${username}: `);
            } else {
                // Second step: checking password
                const password = input;
                
                // Attempt to spawn a shell using the given username/password
                const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
                const ptyProcess = pty.spawn(shell, [], {
                    name: 'xterm-color',
                    cols: 80,
                    rows: 30,
                    cwd: process.env.HOME,
                    env: { ...process.env, USER: username }
                });

                ptyProcess.write(`${username}\n${password}\n`);

                authenticatedUsers[ws] = ptyProcess;

                ptyProcess.on('data', (data) => {
                    ws.send(data);
                });

                ws.send('Connection successful.\n');
                authenticated = true;
            }
        } else {
            // Handle terminal commands after authentication
            authenticatedUsers[ws].write(msg);
        }
    });

    ws.on('close', () => {
        if (authenticatedUsers[ws]) {
            authenticatedUsers[ws].kill();
            delete authenticatedUsers[ws];
        }
    });
});

// File upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    res.send({ message: 'File uploaded successfully!' });
});

// File download endpoint
app.get('/download/:filename', (req, res) => {
    const file = path.join(__dirname, 'uploads', req.params.filename);
    res.download(file);
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
