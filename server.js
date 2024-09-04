const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
  const ptyProcess = pty.spawn('bash', [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME,
    env: process.env
  });

  ptyProcess.on('data', (data) => {
    ws.send(data);
  });

  ws.on('message', (message) => {
    ptyProcess.write(message);
  });

  ws.on('close', () => {
    ptyProcess.kill();
  });
});

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});
