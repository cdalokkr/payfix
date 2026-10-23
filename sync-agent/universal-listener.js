const net = require('net');

const PORT = 8005;

const server = net.createServer((socket) => {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`\n🔥 [${new Date().toISOString()}] NEW CONNECTION FROM: ${remote}`);

    socket.on('data', (chunk) => {
        console.log(`📦 Data received from ${remote} (${chunk.length} bytes):`);
        console.log('HEX:', chunk.toString('hex'));
        console.log('TEXT:', chunk.toString('utf8').replace(/[^\x20-\x7E\r\n\t]/g, '.'));

        // If HTTP request, respond with HTTP OK
        if (chunk.toString('utf8').startsWith('POST') || chunk.toString('utf8').startsWith('GET')) {
            const response = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 3\r\nConnection: close\r\n\r\nOK\n";
            socket.write(response);
            console.log('Sent HTTP 200 OK');
        } else {
            // Echo or ACK
            socket.write(Buffer.from([0x06])); // ACK
        }
    });

    socket.on('error', (err) => {
        console.error(`Socket error from ${remote}:`, err.message);
    });

    socket.on('close', () => {
        console.log(`Connection closed from ${remote}`);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`📡 Universal Raw TCP/HTTP Listener running on 0.0.0.0:${PORT}`);
    console.log(`Waiting for TimeWatch ATF-305 (192.168.1.101)...`);
});
