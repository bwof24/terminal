const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { exec } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Multer setup for handling file uploads
const upload = multer({ dest: 'uploads/' });

// Helper function to check if a user exists
function userExists(username, callback) {
    exec(`getent passwd ${username}`, (error, stdout) => {
        if (error) {
            callback(false);
        } else {
            callback(!!stdout);
        }
    });
}

// Authentication middleware for checking credentials
let authenticatedUsers = {};

wss.on('connection', (ws) => {
    let authenticated = false;
    let username = '';

    ws.send('Authentication required!\nEnter username: ');

    ws.on('message', (msg) => {
        const message = msg.toString();
        if (!authenticated) {
            const input = message.trim();
            if (!username) {
                // First step: asking for username
                username = input;
                userExists(username, (exists) => {
                    if (exists) {
                        ws.send(`Password for ${username}: `);
                    } else {
                        ws.send('Username not found.\n');
                        ws.close(); // Close connection if username is invalid
                    }
                });
            } else {
                // Second step: checking password (mock check)
                const password = input;
                
                // For real systems, integrate with PAM or another secure authentication service
                if (true) { // Replace this condition with actual password check
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
                } else {
                    ws.send('Invalid password.\n');
                    ws.close(); // Close connection if password is invalid
                }
            }
        } else {
            authenticatedUsers[ws].write(message);
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
