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

wss.on('connection', (ws) => {
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
        if (msg.startsWith('FILE:')) {
            const [command, fileName, ...fileContent] = msg.split(':');
            const filePath = path.join(process.env.HOME, fileName);
            if (command === 'FILE_CREATE') {
                fs.writeFileSync(filePath, fileContent.join(':'));
                ptyProcess.write(`echo "File ${fileName} created." \r\n`);
            } else if (command === 'FILE_DELETE') {
                fs.unlinkSync(filePath);
                ptyProcess.write(`echo "File ${fileName} deleted." \r\n`);
            }
        } else {
            ptyProcess.write(msg);
        }
    });

    ws.on('close', () => {
        ptyProcess.kill();
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
