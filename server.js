const WebSocket = require('ws');
const express = require('express');
const { exec } = require('child_process');
const multer = require('multer');
const path = require('path');

const app = express();
const port = 8080;

// Serve static files (frontend)
app.use(express.static('public'));

// File upload setup
const upload = multer({ dest: 'uploads/' });
app.post('/upload', upload.single('file'), (req, res) => {
    res.send('File uploaded successfully');
});

// Download file
app.get('/download/:filename', (req, res) => {
    const file = path.join(__dirname, 'uploads', req.params.filename);
    res.download(file);
});

const server = app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

// WebSocket server
const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
    ws.on('message', message => {
        exec(message, (error, stdout, stderr) => {
            if (error) {
                ws.send(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                ws.send(`stderr: ${stderr}`);
                return;
            }
            ws.send(`stdout: ${stdout}`);
        });
    });
});
