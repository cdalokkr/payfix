const http = require('http');

const PORT = 8005;

const server = http.createServer((req, res) => {
    let body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
        const rawBody = Buffer.concat(body).toString();
        const timestamp = new Date().toISOString();
        console.log(`\n================== [${timestamp}] ==================`);
        console.log(`Incoming Request: ${req.method} ${req.url}`);
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        if (rawBody) {
            console.log('Body:', rawBody);
        } else {
            console.log('Body: <empty>');
        }
        console.log('====================================================\n');

        // Respond with standard ADMS OK
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK\n');
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`📡 TimeWatch Diagnostic Server listening on 0.0.0.0:${PORT}`);
    console.log(`Change device ServerIP to 192.168.1.25 and ServerPort to ${PORT} to test!`);
});
