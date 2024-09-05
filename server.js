const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const pam = require('authenticate-pam');

const app = express();
const server = http.createServer(app);
const wsServer = new WebSocket.Server({ server });

app.use(express.static('public'));

// Authentication middleware using PAM
function pamAuthenticate(username, password) {
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

wsServer.on('connection', (ws) => {
    ws.send('Please authenticate with your system username and password.');

    let isAuthenticated = false;
    let username, password;

    ws.on('message', async (msg) => {
        if (!isAuthenticated) {
            const [type, data] = msg.split(':');

            if (type === 'username') {
                username = data.trim();
                ws.send('Password:'); // Ask for the password next
            } else if (type === 'password') {
                password = data.trim();

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
                        ws.send(data);
                    });

                    ws.on('message', (msg) => {
                        if (isAuthenticated) {
                            ptyProcess.write(msg);
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
                username = data.trim();
                ws.send('Password:'); // Ask for the password next
            } else if (type === 'password') {
                password = data.trim();

                try {
                    await pamAuthenticate(username, password);
                    isAuthenticated = true;
                    ws.send('Authentication successful. Starting terminal...');

                    // If authentication is successful, start the PTY
                    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

                    const ptyProcess = pty.spawn(shell, [], {
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
                        if (isAuthenticated) {
                            // Write each keypress directly to the terminal
                            ptyProcess.write(msg);
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
