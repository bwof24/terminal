const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const pam = require('authenticate-pam');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

// Authentication middleware using PAM
async function pamAuthenticate(username, password) {
    return new Promise((resolve, reject) => {
        pam.authenticate(username, password, (err) => {
            if (err) {
                reject(new Error('Authentication failed'));
            } else {
                resolve(true);
            }
        });
    });
}

wss.on('connection', (ws) => {
    ws.send('Please authenticate with your system username and password.');

    let isAuthenticated = false;
    let username, password;

    ws.on('message', async (msg) => {
        if (!isAuthenticated) {
            let data;
            if (Buffer.isBuffer(msg)) {
                data = msg.toString(); // Convert buffer to string
            } else {
                data = msg; // Already a string
            }

            const [type, value] = data.split(':');
            if (type === 'username') {
                username = value.trim();
                ws.send('Password:'); // Ask for the password next
            } else if (type === 'password') {
                password = value.trim();

                try {
                    await pamAuthenticate(username, password);
                    isAuthenticated = true;
                    ws.send('Authentication successful. Starting terminal...');

                    // Start the PTY after successful authentication
                    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

                    const ptyProcess = pty.spawn(shell, [], {
                        name: 'xterm-color',
                        cols: 80,
                        rows: 30,
                        cwd: process.env.HOME,
                        env: process.env
                    });

                    ptyProcess.on('data', (data) => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(data);
                        }
                    });

                    ws.on('message', (msg) => {
                        if (isAuthenticated && ws.readyState === WebSocket.OPEN) {
                            if (Buffer.isBuffer(msg)) {
                                ptyProcess.write(msg.toString());
                            } else {
                                ptyProcess.write(msg);
                            }
                        }
                    });

                    ws.on('close', () => {
                        ptyProcess.kill();
                    });

                } catch (err) {
                    ws.send('Authentication failed. Please try again.');
                    ws.close();
                }
            }
        }
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });

    ws.on('close', () => {
        if (!isAuthenticated) {
            console.log('Connection closed due to failed authentication.');
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
