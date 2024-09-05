const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));

let ptyProcess = null;

function startPtyProcess(ws) {
    const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    ptyProcess = pty.spawn(shell, [], {
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
        ptyProcess.write(msg);
    });

    ws.on('close', () => {
        ptyProcess.kill();
        ptyProcess = null;
    });
}

wss.on('connection', (ws) => {
    startPtyProcess(ws);

    ws.on('message', (msg) => {
        if (msg === 'cd ..') {
            ptyProcess.write('cd ..\r');
        } else if (msg === 'new_session') {
            startPtyProcess(ws);
        } else if (msg === 'upload') {
            // Handle upload logic here
        } else if (msg === 'download') {
            // Handle download logic here
        } else if (msg === 'edit') {
            ptyProcess.write('nano\r'); // or any other editor
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
