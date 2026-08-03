/**
 * eSSL eTimeTrackLite MS SQL Desktop Database Bridge
 * Connects to local eTimeTrackLite MS SQL Database and streams new attendance logs to PayFix Cloud.
 */

require('dotenv').config();
const axios = require('axios');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const CLOUD_API_URL = process.env.CLOUD_API_URL || 'http://localhost:3000/api/biometric/sync';
const BIOMETRIC_API_KEY = process.env.BIOMETRIC_API_KEY || 'default-biometric-secret-key-change-in-prod';
const DEVICE_ID = process.env.DEVICE_ID || 'essl-desktop-bridge';
const LAST_ID_FILE = path.join(__dirname, 'last_sql_id.json');

function getLastLogId() {
    if (fs.existsSync(LAST_ID_FILE)) {
        try {
            const data = fs.readFileSync(LAST_ID_FILE, 'utf8');
            return JSON.parse(data).lastId || 0;
        } catch (e) {
            console.error('Error reading last_sql_id.json:', e);
        }
    }
    return 0;
}

function updateLastLogId(id) {
    fs.writeFileSync(LAST_ID_FILE, JSON.stringify({ lastId: id }));
}

async function syncSqlDatabaseLogs() {
    let mssql;
    try {
        mssql = require('mssql');
    } catch (e) {
        console.log('`mssql` package not installed. Run `npm install mssql` in sync-agent folder for desktop eTimeTrackLite DB bridge.');
        return;
    }

    const config = {
        user: process.env.MSSQL_USER || 'sa',
        password: process.env.MSSQL_PASSWORD || 'essl@123',
        server: process.env.MSSQL_HOST || 'localhost',
        database: process.env.MSSQL_DB || 'eTimeTrackLite1',
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };

    try {
        await mssql.connect(config);
        const lastId = getLastLogId();

        // Query eTimeTrackLite logs table
        const result = await mssql.query`
            SELECT TOP 100 DeviceLogId, UserId, LogDate, Direction 
            FROM DeviceLogs 
            WHERE DeviceLogId > ${lastId} 
            ORDER BY DeviceLogId ASC
        `;

        if (!result.recordset || result.recordset.length === 0) {
            console.log('No new logs in eTimeTrackLite MS SQL database.');
            await mssql.close();
            return;
        }

        console.log(`Fetched ${result.recordset.length} new records from eTimeTrackLite DB.`);

        const logs = result.recordset.map(row => ({
            userId: String(row.UserId),
            timestamp: new Date(row.LogDate).toISOString(),
            punchType: row.Direction === 'out' ? 1 : 0
        }));

        const response = await axios.post(CLOUD_API_URL, {
            deviceId: DEVICE_ID,
            logs
        }, {
            headers: {
                'Authorization': `Bearer ${BIOMETRIC_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.success) {
            const maxId = Math.max(...result.recordset.map(r => r.DeviceLogId));
            updateLastLogId(maxId);
            console.log(`[MS SQL Bridge] Synced logs up to DeviceLogId ${maxId}`);
        }

        await mssql.close();
    } catch (err) {
        console.error('[MS SQL Bridge Error]:', err.message);
        if (mssql) mssql.close();
    }
}

// Poll eTimeTrackLite MS SQL DB every 1 minute
cron.schedule('*/1 * * * *', () => {
    syncSqlDatabaseLogs();
});

console.log('eSSL eTimeTrackLite MS SQL Bridge started. Listening for new punches every 1 minute.');
