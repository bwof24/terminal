const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

let activeTerminals = {};

wss.on('connection', (ws) => {
    console.log('New client connected');

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

    ptyProcess.on('data', (data) => {
        ws.send(JSON.stringify({ type: 'output', data }));
    });

    ws.on('message', (message) => {
        const { type, data } = JSON.parse(message);
        if (type === 'input') {
            ptyProcess.write(data);
        } else if (type === 'command') {
            ptyProcess.write(`${data}\n`);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        ptyProcess.kill();
        delete activeTerminals[sessionId];
    });

    ws.send(JSON.stringify({ type: 'session', sessionId }));
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
