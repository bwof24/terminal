const WebSocket = require('ws');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const express = require('express');
const app = express();
const port = 3000;

// Serve static files
app.use(express.static('public'));

const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', ws => {
    console.log('Client connected');

    ws.on('message', message => {
        console.log(`Received message: ${message}`);

        if (message.startsWith('echo ')) {
            const [ , content ] = message.split('> ');
            const fileName = content.split('\n')[0];
            const fileContent = content.substring(fileName.length + 1);
            fs.writeFile(path.join(__dirname, fileName), fileContent, err => {
                if (err) {
                    ws.send('Error writing file\n');
                } else {
                    ws.send('File written successfully\n');
                }
            });
        } else if (message.startsWith('cat ')) {
            const fileName = message.split(' ')[1];
            fs.readFile(path.join(__dirname, fileName), 'utf8', (err, data) => {
                if (err) {
                    ws.send('Error reading file\n');
                } else {
                    ws.send(data);
                }
            });
        } else {
            exec(message, (error, stdout, stderr) => {
                if (error) {
                    ws.send(`Error: ${stderr}\n`);
                } else {
                    ws.send(stdout);
                }
            });
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

const server = app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, ws => {
        wss.emit('connection', ws, request);
    });
});
