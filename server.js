const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const pty = require('node-pty');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket connection for terminal
wss.on('connection', (ws) => {
    const shell = pty.spawn('bash', [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: process.env.HOME,
        env: process.env
    });

    shell.on('data', (data) => {
        ws.send(data);
    });

    ws.on('message', (message) => {
        shell.write(message);
    });

    ws.on('close', () => {
        shell.kill();
    });
});

server.listen(8080, () => {
    console.log('Server running on http://localhost:8080');
});
