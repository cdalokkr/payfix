require('dotenv').config();
const ZKLib = require('node-zklib');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const BIOMETRIC_IP = process.env.BIOMETRIC_IP || '192.168.1.201';
const BIOMETRIC_PORT = parseInt(process.env.BIOMETRIC_PORT || '4370', 10);
const CLOUD_API_URL = process.env.CLOUD_API_URL || 'http://localhost:3000/api/biometric/sync';
const BIOMETRIC_API_KEY = process.env.BIOMETRIC_API_KEY || 'default-biometric-secret-key-change-in-prod';
const DEVICE_ID = process.env.DEVICE_ID || 'biometric-001';

const LAST_SYNC_FILE = path.join(__dirname, 'last_sync.json');

function getLastSyncTime() {
    if (fs.existsSync(LAST_SYNC_FILE)) {
        try {
            const data = fs.readFileSync(LAST_SYNC_FILE, 'utf8');
            return new Date(JSON.parse(data).lastSyncTimestamp);
        } catch (e) {
            console.error('Error reading last sync file:', e);
        }
    }
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return startOfDay;
}

function updateLastSyncTime(timestamp) {
    fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({ lastSyncTimestamp: timestamp.toISOString() }));
}

async function sendPunchesToCloud(logs) {
    if (!logs || logs.length === 0) return;
    try {
        console.log(`[Cloud Sync] Pushing ${logs.length} punch records to cloud...`);
        const payload = { deviceId: DEVICE_ID, logs };

        const response = await axios.post(CLOUD_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${BIOMETRIC_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        if (response.data.success) {
            console.log(`[Cloud Sync Success]: ${response.data.message}`);
            const latest = new Date(Math.max(...logs.map(l => new Date(l.timestamp).getTime())));
            updateLastSyncTime(latest);
        } else {
            console.error('[Cloud Sync Failed]:', response.data.error);
        }
    } catch (e) {
        console.error('[Cloud Sync Error]:', e.message);
    }
}

async function syncAttendanceCron() {
    console.log(`[${new Date().toISOString()}] Running periodic eSSL socket sync...`);
    const zkInstance = new ZKLib(BIOMETRIC_IP, BIOMETRIC_PORT, 10000, 4000);

    try {
        await zkInstance.createSocket();
        const attendances = await zkInstance.getAttendances();
        const lastSyncTime = getLastSyncTime();

        const newLogs = attendances.data
            .map(log => ({
                userId: String(log.deviceUserId),
                timestamp: new Date(log.recordTime).toISOString(),
                punchType: log.recordType,
            }))
            .filter(log => new Date(log.timestamp) > lastSyncTime);

        if (newLogs.length > 0) {
            await sendPunchesToCloud(newLogs);
        } else {
            console.log('No new punches to sync.');
        }

        await zkInstance.disconnect();
    } catch (e) {
        console.error('eSSL Socket Sync Error:', e.message);
    }
}

async function startRealtimeListener() {
    console.log(`Starting real-time socket listener on ${BIOMETRIC_IP}:${BIOMETRIC_PORT}...`);
    const zkInstance = new ZKLib(BIOMETRIC_IP, BIOMETRIC_PORT, 20000, 4000);

    try {
        await zkInstance.createSocket();
        console.log('Connected to eSSL device via socket for real-time events!');

        // Register Realtime Log Event Listener
        zkInstance.getRealTimeLogs((err, data) => {
            if (err) {
                console.error('[Realtime Socket Error]:', err);
                return;
            }
            if (data) {
                console.log('⚡ Real-time Punch Received:', data);
                const log = {
                    userId: String(data.userId || data.deviceUserId),
                    timestamp: new Date(data.attTime || data.recordTime || new Date()).toISOString(),
                    punchType: data.punchType ?? 0
                };
                sendPunchesToCloud([log]);
            }
        });

    } catch (err) {
        console.warn('Realtime listener failed to initialize (falling back to 5-min cron):', err.message);
    }
}

// Start listeners & schedules
startRealtimeListener();
syncAttendanceCron();

cron.schedule('*/5 * * * *', () => {
    syncAttendanceCron();
});

console.log(`Universal eSSL Sync Agent running for device: ${DEVICE_ID}`);

