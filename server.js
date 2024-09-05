const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));
app.use(express.json());

// Serve static files (like HTML, CSS, JS)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Authenticate user
app.post('/authenticate', (req, res) => {
    const { username, password } = req.body;
    exec(`echo ${password} | su -c "id -u ${username}"`, (err, stdout, stderr) => {
        if (err || stderr) {
            res.status(401).send('Authentication failed!');
        } else {
            res.status(200).send('Connection successful!');
        }
    });
});

wss.on('connection', (ws, req) => {
    let shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';

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
        ptyProcess.write(msg);
    });

    ws.on('close', () => {
        ptyProcess.kill();
    });
});

// Upload file
app.post('/upload', upload.single('file'), (req, res) => {
    const tempPath = req.file.path;
    const targetPath = path.join(__dirname, 'uploads', req.file.originalname);

    fs.rename(tempPath, targetPath, err => {
        if (err) return res.status(500).send('Upload failed!');
        res.status(200).send('Upload successful!');
    });
});

// Download file
app.get('/download/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, 'uploads', fileName);
    res.download(filePath, err => {
        if (err) res.status(500).send('Download failed!');
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
