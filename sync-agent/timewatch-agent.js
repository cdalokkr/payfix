const net = require('net');
const http = require('http');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Log file for persistent real-time inspection
const LOG_FILE = path.resolve(__dirname, 'timewatch-live.log');

function logLive(msg) {
    const ts = new Date().toLocaleTimeString('en-IN', { hour12: false });
    const line = `[${ts}] ${msg}`;
    console.log(line);
    try {
        fs.appendFileSync(LOG_FILE, line + '\n');
    } catch (e) {}
}

// Clear or start fresh log
try {
    fs.writeFileSync(LOG_FILE, `=== TIMEWATCH LISTENER STARTED AT ${new Date().toISOString()} ===\n`);
} catch (e) {}

// Load env from .env.local in root
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hkbbybkeatrtdbqfurtc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYmJ5YmtlYXRydGRicWZ1cnRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODEzNDgyNCwiZXhwIjoyMDgzNzEwODI0fQ.lAA8KBHLLTVNdFFGFxS3ycJdcrkCE5LC-S9bDDOfcH4';
const LOCAL_API_URL = process.env.LOCAL_API_URL || 'http://localhost:3000/api/biometric/sync';
const API_KEY = process.env.BIOMETRIC_API_KEY || 'bfx_live_timewatch_primary_2026';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function cleanUserId(raw) {
    if (!raw) return '';
    const trimmed = String(raw).trim();
    const asNum = parseInt(trimmed, 10);
    return !isNaN(asNum) ? String(asNum) : trimmed;
}

function parseFkWebTimestamp(ioTime) {
    if (!ioTime || ioTime.length < 14) return new Date().toISOString();
    const y = ioTime.slice(0, 4);
    const m = ioTime.slice(4, 6);
    const d = ioTime.slice(6, 8);
    const h = ioTime.slice(8, 10);
    const mi = ioTime.slice(10, 12);
    const s = ioTime.slice(12, 14);
    return `${y}-${m}-${d}T${h}:${mi}:${s}+05:30`;
}

function parseXmlField(str, tag) {
    const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i');
    const match = str.match(regex);
    return match ? match[1].trim() : '';
}

// Direct Supabase Fallback Sync so attendance is guaranteed even if Next dev server is stopped
async function syncPunchToDatabase({ userId, timestamp, punchType, deviceSerial, rawPayload }) {
    try {
        logLive(`\n🎯 ========================================================`);
        logLive(`🎯 PUNCH DETECTED FROM MACHINE! User ID: "${userId}" at ${timestamp}`);
        logLive(`🎯 ========================================================`);
        
        // Sound a terminal bell
        process.stdout.write('\x07');

        // 1. Find mapped employee profile
        const { data: settings, error: sErr } = await supabase
            .from('employee_settings')
            .select('profile_id')
            .eq('biometric_device_user_id', String(userId))
            .maybeSingle();

        const profileId = settings?.profile_id || null;
        let employeeName = 'Unmapped User';

        if (profileId) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, email, role')
                .eq('id', profileId)
                .maybeSingle();
            if (profile) {
                employeeName = profile.full_name || profile.email;
            }
        }

        logLive(`👤 Employee Identified: ${employeeName} (Profile ID: ${profileId || 'NONE'})`);

        // 2. Insert into biometric_raw_logs
        const punchDate = new Date(timestamp);
        const { error: rawErr } = await supabase
            .from('biometric_raw_logs')
            .insert({
                profile_id: profileId,
                biometric_user_id: String(userId),
                device_id: deviceSerial || '1',
                punch_time: punchDate.toISOString(),
                punch_type: punchType || 0,
                raw_payload: rawPayload || {}
            });

        if (rawErr) {
            logLive(`⚠️ [RawLog Error]: ${rawErr.message}`);
        } else {
            logLive('📝 Audit punch recorded in "biometric_raw_logs".');
        }

        // 3. Try forwarding to local Next.js API if running
        try {
            const res = await axios.post(LOCAL_API_URL, {
                deviceId: deviceSerial || '1',
                logs: [{ userId, timestamp: punchDate.toISOString(), punchType: punchType || 0 }]
            }, {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 3000
            });
            logLive(`🌐 Next.js API Synced successfully: ${JSON.stringify(res.data)}`);
            return;
        } catch (apiErr) {
            logLive(`ℹ️ Local Next.js API offline (${apiErr.code || apiErr.message}). Writing directly to Supabase attendance table...`);
        }

        if (!profileId) {
            logLive(`⚠️ Biometric User ID ${userId} is not mapped in employee_settings. Saved to raw logs.`);
            return;
        }

        // 4. Session management in Supabase
        const istDateStr = `${punchDate.getFullYear()}-${String(punchDate.getMonth() + 1).padStart(2, '0')}-${String(punchDate.getDate()).padStart(2, '0')}`;
        
        // Find existing attendance parent record for today
        let { data: attRecord } = await supabase
            .from('attendance')
            .select('*')
            .eq('profile_id', profileId)
            .eq('date', istDateStr)
            .maybeSingle();

        if (!attRecord) {
            const { data: newAtt, error: attCreateErr } = await supabase
                .from('attendance')
                .insert({
                    profile_id: profileId,
                    date: istDateStr,
                    check_in: punchDate.toISOString(),
                    first_check_in: punchDate.toISOString(),
                    status: 'present',
                    source: 'biometric',
                    current_session_status: 'checked_in',
                    device_id: deviceSerial || '1'
                })
                .select()
                .single();
            if (attCreateErr) {
                logLive(`❌ Error creating attendance record: ${attCreateErr.message}`);
                return;
            }
            attRecord = newAtt;
        }

        // Find active session
        const { data: activeSession } = await supabase
            .from('attendance_sessions')
            .select('*')
            .eq('attendance_id', attRecord.id)
            .eq('status', 'active')
            .maybeSingle();

        if (punchType === 1 && activeSession) {
            // Clock out
            await supabase
                .from('attendance_sessions')
                .update({
                    check_out: punchDate.toISOString(),
                    status: 'completed',
                    updated_at: new Date().toISOString()
                })
                .eq('id', activeSession.id);

            await supabase
                .from('attendance')
                .update({
                    check_out: punchDate.toISOString(),
                    last_check_out: punchDate.toISOString(),
                    current_session_status: 'checked_out',
                    updated_at: new Date().toISOString()
                })
                .eq('id', attRecord.id);

            logLive(`✅ [CLOCK OUT SUCCESS]: ${employeeName} clocked out at ${punchDate.toLocaleTimeString('en-IN')}`);
        } else if (!activeSession && (!punchType || punchType === 0)) {
            // Clock in
            await supabase
                .from('attendance_sessions')
                .insert({
                    attendance_id: attRecord.id,
                    check_in: punchDate.toISOString(),
                    status: 'active'
                });

            await supabase
                .from('attendance')
                .update({
                    current_session_status: 'checked_in',
                    updated_at: new Date().toISOString()
                })
                .eq('id', attRecord.id);

            logLive(`✅ [CLOCK IN SUCCESS]: ${employeeName} CLOCKED IN at ${punchDate.toLocaleTimeString('en-IN')}! Attendance Session Active.`);
        } else {
            logLive(`ℹ️ Session already active: Punch recorded for ${employeeName}. Current status: ${attRecord.current_session_status}`);
        }

    } catch (err) {
        logLive(`💥 Fatal error in syncPunchToDatabase: ${err.message}`);
    }
}

// Multi-Protocol Connection Handler
function handleConnection(socket, port) {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    logLive(`\n🔔 Incoming connection on Port ${port} from ${remote}`);

    // Set idle timeout: 20s
    socket.setTimeout(20000);
    socket.on('timeout', () => {
        logLive(`⏱️ Connection idle timeout from ${remote}. Closing cleanly.`);
        socket.end();
    });

    let buffer = Buffer.alloc(0);

    socket.on('data', async (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const text = buffer.toString('utf8');

        // Log raw preview
        const preview = chunk.slice(0, 100).toString('utf8').replace(/[\r\n]/g, ' ');
        logLive(`📡 [DATA from ${remote}] (${chunk.length} bytes): ${preview}`);

        // 1. CHECK IF HTTP REQUEST
        if (text.includes('\r\n\r\n')) {
            const [headerPart, ...bodyParts] = text.split('\r\n\r\n');
            const bodyPart = bodyParts.join('\r\n\r\n');
            const lines = headerPart.split('\r\n');
            const requestLine = lines[0];

            // Parse headers
            const headers = {};
            for (let i = 1; i < lines.length; i++) {
                const colonIdx = lines[i].indexOf(':');
                if (colonIdx > 0) {
                    const k = lines[i].slice(0, colonIdx).trim().toLowerCase();
                    const v = lines[i].slice(colonIdx + 1).trim();
                    headers[k] = v;
                }
            }

            const contentLength = parseInt(headers['content-length'] || '0', 10);
            if (Buffer.byteLength(bodyPart) < contentLength) {
                // Wait for remainder of HTTP body
                return;
            }

            const requestCode = headers['request_code'] || '';
            const devId = headers['dev_id'] || '1';
            const transId = headers['trans_id'] || '1';

            logLive(`📋 HTTP Request: "${requestLine}"`);
            logLive(`📋 Headers: request_code="${requestCode}", dev_id="${devId}", trans_id="${transId}"`);

            // Parse JSON body if present
            let parsedBody = null;
            if (bodyPart.includes('{')) {
                try {
                    const jsonStart = bodyPart.indexOf('{');
                    const jsonEnd = bodyPart.lastIndexOf('}');
                    parsedBody = JSON.parse(bodyPart.slice(jsonStart, jsonEnd + 1));
                    logLive(`🧩 Parsed JSON: ${JSON.stringify(parsedBody)}`);
                } catch (e) {}
            }

            // Check ADMS /iclock push format
            if (requestLine.includes('/iclock/cdata') || requestLine.includes('/iclock/getrequest')) {
                logLive(`ℹ️ ZKTeco/ADMS protocol detected on port ${port}`);
                if (bodyPart && bodyPart.length > 0) {
                    const punchLines = bodyPart.split('\n');
                    for (const pl of punchLines) {
                        const parts = pl.trim().split('\t');
                        if (parts.length >= 2) {
                            const uId = cleanUserId(parts[0]);
                            const pTime = parts[1];
                            if (uId && pTime) {
                                await syncPunchToDatabase({
                                    userId: uId,
                                    timestamp: new Date(pTime).toISOString(),
                                    punchType: 0,
                                    deviceSerial: devId,
                                    rawPayload: { line: pl }
                                });
                            }
                        }
                    }
                }
                const admsRes = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK";
                socket.write(admsRes);
                socket.end();
                return;
            }

            // Handle Attendance Event (realtime_glog or user_id in body/header)
            if (requestCode === 'realtime_glog' || parsedBody?.user_id || headers['user_id']) {
                const rawUserId = parsedBody?.user_id || headers['user_id'];
                const userId = cleanUserId(rawUserId);
                const timestamp = parseFkWebTimestamp(parsedBody?.io_time);
                const punchType = (parsedBody?.io_mode === 2) ? 1 : 0;

                await syncPunchToDatabase({
                    userId,
                    timestamp,
                    punchType,
                    deviceSerial: devId,
                    rawPayload: parsedBody || { text: bodyPart }
                });
            }

            // Respond with EBKN ACK
            const response = [
                'HTTP/1.1 200 OK',
                'Content-Type: application/octet-stream',
                'response_code: OK',
                `trans_id: ${transId}`,
                'Connection: close',
                'Content-Length: 0',
                '',
                ''
            ].join('\r\n');

            socket.write(response);
            logLive(`📤 Sent FkWeb 200 OK response (trans_id: ${transId})`);
            socket.end();
            return;
        }

        // 2. CHECK IF LOGCLIENT XML FORMAT
        if (text.startsWith('<?xml') || text.startsWith('<Message') || text.includes('</Message>')) {
            logLive(`📥 LogClient XML format detected (${buffer.length} bytes)`);

            const event = parseXmlField(text, 'Event');
            const transId = parseXmlField(text, 'TransID') || '1';
            const userId = cleanUserId(parseXmlField(text, 'UserID'));
            const attendStat = parseXmlField(text, 'AttendStat');
            const serialNo = parseXmlField(text, 'DeviceSerialNo') || '1';

            logLive(`📋 XML Event: "${event}", UserID: "${userId}", TransID: "${transId}"`);

            if ((event === 'TimeLog' || event === 'realtime_glog') && userId) {
                const year = parseXmlField(text, 'Year') || new Date().getFullYear();
                const month = String(parseXmlField(text, 'Month') || (new Date().getMonth() + 1)).padStart(2, '0');
                const day = String(parseXmlField(text, 'Day') || new Date().getDate()).padStart(2, '0');
                const hour = String(parseXmlField(text, 'Hour') || new Date().getHours()).padStart(2, '0');
                const minute = String(parseXmlField(text, 'Minute') || new Date().getMinutes()).padStart(2, '0');
                const second = String(parseXmlField(text, 'Second') || new Date().getSeconds()).padStart(2, '0');
                
                const timestamp = `${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`;
                const punchType = (attendStat.toLowerCase().includes('off')) ? 1 : 0;

                await syncPunchToDatabase({
                    userId,
                    timestamp,
                    punchType,
                    deviceSerial: serialNo,
                    rawPayload: { xml: text }
                });
            }

            // BioFace M61 Modular Protocol reply format (Must terminate with 0x00)
            const requestType = (event === 'KeepAlive') ? 'KeptAlive' : 'UploadedLog';
            const ackXml = `<?xml version="1.0"?><Message><Request>${requestType}</Request><TransID>${transId}</TransID></Message>\0`;
            
            socket.write(ackXml, 'ascii');
            logLive(`📤 Sent XML ACK: Request=${requestType}, TransID=${transId} with NULL byte.`);
            socket.end();
            return;
        }

        // 3. Fallback generic HTTP response
        if (text.startsWith('GET ') || text.startsWith('POST ')) {
            const res = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nOK\n";
            socket.write(res);
            socket.end();
            return;
        }
    });

    socket.on('error', (err) => {
        if (err.code !== 'ECONNRESET') {
            logLive(`Socket notice from ${remote}: ${err.message}`);
        }
    });

    socket.on('close', () => {
        // Closed cleanly
    });
}

function startServer(port) {
    const server = net.createServer((socket) => handleConnection(socket, port));
    server.on('error', (err) => {
        logLive(`❌ Port ${port} error: ${err.message}`);
    });
    server.listen(port, '0.0.0.0', () => {
        logLive(`🚀 TimeWatch Biometric Listener active on 0.0.0.0:${port}`);
    });
}

// Start listeners
logLive('====================================================');
logLive('  🕒 PAYFIX TIMEWATCH ATF-305 DIRECT LISTENER');
logLive('====================================================');
logLive(`Supabase URL: ${SUPABASE_URL}`);
logLive(`Device IP: 192.168.1.101`);
logLive(`Server IP: 192.168.1.25`);
logLive(`Listening on Ports: 8005 and 5005`);
logLive('====================================================\n');

startServer(8005);
try {
    startServer(5005);
} catch (e) {
    logLive(`Port 5005 bind notice: ${e.message}`);
}
