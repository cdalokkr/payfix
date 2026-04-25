require('dotenv').config();
const ZKLib = require('node-zklib');
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const BIOMETRIC_IP = process.env.BIOMETRIC_IP || '192.168.1.201';
const BIOMETRIC_PORT = process.env.BIOMETRIC_PORT || 4370;
const CLOUD_API_URL = process.env.CLOUD_API_URL || 'http://localhost:3000/api/biometric/sync';
const BIOMETRIC_API_KEY = process.env.BIOMETRIC_API_KEY || 'default-biometric-secret-key-change-in-prod';
const DEVICE_ID = process.env.DEVICE_ID || 'biometric-001';

const LAST_SYNC_FILE = path.join(__dirname, 'last_sync.json');

// Get last sync time from file
function getLastSyncTime() {
    if (fs.existsSync(LAST_SYNC_FILE)) {
        try {
            const data = fs.readFileSync(LAST_SYNC_FILE, 'utf8');
            return new Date(JSON.parse(data).lastSyncTimestamp);
        } catch (e) {
            console.error('Error reading last sync file:', e);
        }
    }
    // Default to beginning of the day if no previous sync
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return startOfDay;
}

// Update last sync time
function updateLastSyncTime(timestamp) {
    fs.writeFileSync(LAST_SYNC_FILE, JSON.stringify({ lastSyncTimestamp: timestamp.toISOString() }));
}

async function syncAttendance() {
    console.log(`[${new Date().toISOString()}] Starting biometric sync cycle...`);
    const zkInstance = new ZKLib(BIOMETRIC_IP, BIOMETRIC_PORT, 10000, 4000);

    try {
        await zkInstance.createSocket();
        
        console.log('Connecting to device...');
        const users = await zkInstance.getUsers();
        console.log(`Found ${users.data.length} users in device.`);
        
        const attendances = await zkInstance.getAttendances();
        console.log(`Found ${attendances.data.length} total attendance records.`);

        const lastSyncTime = getLastSyncTime();
        console.log(`Filtering records after ${lastSyncTime.toISOString()}`);

        const newLogs = attendances.data
            .map(log => ({
                userId: log.deviceUserId, // ID of the user in the biometric machine
                timestamp: new Date(log.recordTime).toISOString(),
                punchType: log.recordType, // Usually 0 is in, 1 is out
            }))
            .filter(log => new Date(log.timestamp) > lastSyncTime);

        if (newLogs.length === 0) {
            console.log('No new punches to sync.');
            await zkInstance.disconnect();
            return;
        }

        console.log(`Pushing ${newLogs.length} new records to cloud...`);

        const payload = {
            deviceId: DEVICE_ID,
            logs: newLogs
        };

        const response = await axios.post(CLOUD_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${BIOMETRIC_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            console.log(`Cloud Sync Success: ${response.data.message}`);
            // Update last sync to the newest timestamp in the logs
            const latestTimestamp = new Date(Math.max(...newLogs.map(l => new Date(l.timestamp).getTime())));
            updateLastSyncTime(latestTimestamp);
        } else {
            console.error('Cloud Sync Failed:', response.data.error);
        }

        await zkInstance.disconnect();
    } catch (e) {
        console.error('Biometric Sync Error:', e);
        if (e.code === 'ECONNREFUSED' || e.code === 'EHOSTUNREACH') {
            console.error('Could not connect to the biometric device. Is the IP correct?');
        }
    }
}

// Run immediately on start
syncAttendance();

// Schedule to run every 5 minutes
cron.schedule('*/5 * * * *', () => {
    syncAttendance();
});

console.log(`Sync Agent started. Polling ${BIOMETRIC_IP} every 5 minutes.`);
