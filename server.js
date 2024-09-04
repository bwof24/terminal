const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

const sessions = {};

wss.on('connection', (ws) => {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME || '/',
        env: process.env
    });

    const sessionId = Date.now();
    sessions[sessionId] = { ptyProcess, ws };

    ptyProcess.on('data', (data) => {
        ws.send(JSON.stringify({ sessionId, data }));
        logOutput(sessionId, data);
    });

    ws.on('message', (message) => {
        try {
            const { sessionId, data } = JSON.parse(message);
            if (sessions[sessionId]) {
                sessions[sessionId].ptyProcess.write(data);
            }
        } catch (error) {
            console.error('Invalid message format:', error);
        }
    });

    ws.on('close', () => {
        if (sessions[sessionId]) {
            sessions[sessionId].ptyProcess.kill();
            delete sessions[sessionId];
        }
    });

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
    };
});

function logOutput(sessionId, data) {
    const filePath = path.join(__dirname, 'logs', `${sessionId}.log`);
    fs.appendFile(filePath, data, (err) => {
        if (err) console.error('Failed to log output:', err);
    });
}

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
