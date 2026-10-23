const net = require('net');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load environment from .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
} else {
    require('dotenv').config();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hkbbybkeatrtdbqfurtc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrYmJ5YmtlYXRydGRicWZ1cnRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODEzNDgyNCwiZXhwIjoyMDgzNzEwODI0fQ.lAA8KBHLLTVNdFFGFxS3ycJdcrkCE5LC-S9bDDOfcH4';
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const PORT = 8005;

async function syncAttendance({ userId, timestamp, punchType, deviceSerial, raw }) {
    console.log(`\n======================================================`);
    console.log(`🎯 [PUNCH DETECTED] User: ${userId} | Time: ${timestamp} | Mode: ${punchType}`);
    console.log(`======================================================`);

    const cleanId = String(parseInt(userId, 10) || userId).trim();

    // 1. Find profile mapped to this biometric user ID
    const { data: settings } = await supabase
        .from('employee_settings')
        .select('profile_id')
        .eq('biometric_device_user_id', cleanId)
        .maybeSingle();

    const profileId = settings?.profile_id || null;
    let employeeName = 'Unmapped User';

    if (profileId) {
        const { data: prof } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', profileId)
            .maybeSingle();
        if (prof) employeeName = prof.full_name || prof.email;
    }

    console.log(`👤 Mapped Employee: ${employeeName} (${profileId || 'No profile'})`);

    const punchDate = new Date(timestamp);
    const dateIST = `${punchDate.getFullYear()}-${String(punchDate.getMonth() + 1).padStart(2, '0')}-${String(punchDate.getDate()).padStart(2, '0')}`;

    // 2. Insert into raw audit logs
    const { error: rawErr } = await supabase.from('biometric_raw_logs').insert({
        profile_id: profileId,
        biometric_user_id: cleanId,
        device_id: deviceSerial || 'C262AC269B1B3133',
        punch_time: punchDate.toISOString(),
        punch_type: punchType || 0,
        raw_payload: raw || {}
    });
    if (rawErr) console.error('RawLog error:', rawErr.message);
    else console.log('✅ Biometric audit log saved.');

    if (!profileId) {
        console.warn('⚠️ User ID not mapped in employee_settings. Raw log saved.');
        return;
    }

    // 3. Update attendance & sessions
    let { data: att } = await supabase
        .from('attendance')
        .select('*')
        .eq('profile_id', profileId)
        .eq('date', dateIST)
        .maybeSingle();

    if (!att) {
        const { data: newAtt } = await supabase
            .from('attendance')
            .insert({
                profile_id: profileId,
                date: dateIST,
                check_in: punchDate.toISOString(),
                first_check_in: punchDate.toISOString(),
                status: 'present',
                source: 'biometric',
                current_session_status: 'checked_in',
                device_id: deviceSerial || 'C262AC269B1B3133'
            })
            .select()
            .single();
        att = newAtt;
    }

    const { data: session } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('attendance_id', att.id)
        .eq('status', 'active')
        .maybeSingle();

    if (punchType === 1 && session) {
        // Clock Out
        await supabase
            .from('attendance_sessions')
            .update({ check_out: punchDate.toISOString(), status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', session.id);
        await supabase
            .from('attendance')
            .update({ check_out: punchDate.toISOString(), last_check_out: punchDate.toISOString(), current_session_status: 'checked_out' })
            .eq('id', att.id);
        console.log(`🎉 [SUCCESS] ${employeeName} CLOCKED OUT at ${punchDate.toLocaleTimeString('en-IN')}`);
    } else if (!session && (!punchType || punchType === 0)) {
        // Clock In
        await supabase
            .from('attendance_sessions')
            .insert({ attendance_id: att.id, check_in: punchDate.toISOString(), status: 'active' });
        await supabase
            .from('attendance')
            .update({ current_session_status: 'checked_in' })
            .eq('id', att.id);
        console.log(`🎉 [SUCCESS] ${employeeName} CLOCKED IN at ${punchDate.toLocaleTimeString('en-IN')}`);
    } else {
        console.log(`ℹ️ Punch recorded for ${employeeName}. Current session status: ${att.current_session_status}`);
    }
}

const server = net.createServer((socket) => {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`\n🔥 [${new Date().toLocaleTimeString('en-IN')}] INCOMING CONNECTION from ${remote}`);

    let buffer = Buffer.alloc(0);

    socket.on('data', async (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        const text = buffer.toString('utf8');
        console.log(`📦 Received ${chunk.length} bytes from ${remote}:`);
        console.log('--- RAW PAYLOAD START ---');
        console.log(text.slice(0, 1000));
        console.log('--- RAW PAYLOAD END ---');

        // 1. FkWeb / EBKN HTTP Protocol
        if (text.includes('\r\n\r\n')) {
            const [headerPart, ...bodyParts] = text.split('\r\n\r\n');
            const bodyPart = bodyParts.join('\r\n\r\n');
            const lines = headerPart.split('\r\n');
            const requestLine = lines[0];

            const headers = {};
            for (let i = 1; i < lines.length; i++) {
                const idx = lines[i].indexOf(':');
                if (idx > 0) {
                    headers[lines[i].slice(0, idx).trim().toLowerCase()] = lines[i].slice(idx + 1).trim();
                }
            }

            const requestCode = headers['request_code'] || '';
            const devId = headers['dev_id'] || 'C262AC269B1B3133';
            const transId = headers['trans_id'] || '1';

            console.log(`📋 Request: ${requestLine} | code=${requestCode} | dev=${devId} | trans=${transId}`);

            // Parse JSON if present
            let parsedJson = null;
            if (bodyPart.includes('{')) {
                try {
                    const start = bodyPart.indexOf('{');
                    const end = bodyPart.lastIndexOf('}');
                    parsedJson = JSON.parse(bodyPart.slice(start, end + 1));
                    console.log('🧩 JSON body:', parsedJson);
                } catch (e) {
                    console.log('JSON parse error:', e.message);
                }
            }

            // If punch event
            if (requestCode === 'realtime_glog' || parsedJson?.user_id) {
                const uid = parsedJson?.user_id || headers['user_id'] || '80';
                let ioTime = parsedJson?.io_time;
                let ts = new Date().toISOString();
                if (ioTime && ioTime.length >= 14) {
                    ts = `${ioTime.slice(0,4)}-${ioTime.slice(4,6)}-${ioTime.slice(6,8)}T${ioTime.slice(8,10)}:${ioTime.slice(10,12)}:${ioTime.slice(12,14)}+05:30`;
                }
                const punchType = (parsedJson?.io_mode === 2) ? 1 : 0;
                await syncAttendance({ userId: uid, timestamp: ts, punchType, deviceSerial: devId, raw: parsedJson || { text } });
            }

            // Standard FkWeb / EBKN ACK response
            const ackResponse = [
                'HTTP/1.1 200 OK',
                'Content-Type: application/octet-stream',
                'response_code: OK',
                `trans_id: ${transId}`,
                'Connection: close',
                'Content-Length: 0',
                '',
                ''
            ].join('\r\n');

            socket.write(ackResponse);
            console.log(`📤 Responded with FkWeb 200 OK (response_code: OK, trans_id: ${transId})`);
            socket.end();
            return;
        }

        // 2. LogClient XML Protocol
        if (text.startsWith('<?xml') || text.startsWith('<Message') || text.includes('</Message>')) {
            const getXmlTag = (tag) => {
                const m = text.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
                return m ? m[1].trim() : '';
            };

            const event = getXmlTag('Event');
            const transId = getXmlTag('TransID') || '1';
            const uid = getXmlTag('UserID');
            const attendStat = getXmlTag('AttendStat');

            console.log(`📋 XML Event: ${event} | UserID: ${uid} | TransID: ${transId}`);

            if (event === 'TimeLog' && uid) {
                const punchType = attendStat.toLowerCase().includes('off') ? 1 : 0;
                await syncAttendance({
                    userId: uid,
                    timestamp: new Date().toISOString(),
                    punchType,
                    deviceSerial: getXmlTag('DeviceSerialNo') || 'C262AC269B1B3133',
                    raw: { xml: text }
                });
            }

            const reqType = (event === 'KeepAlive') ? 'KeptAlive' : 'UploadedLog';
            const xmlAck = `<?xml version="1.0"?><Message><Request>${reqType}</Request><TransID>${transId}</TransID></Message>\0`;
            socket.write(xmlAck, 'ascii');
            console.log(`📤 Responded with XML ACK (${reqType})`);
            socket.end();
            return;
        }

        // 3. Fallback HTTP
        if (text.startsWith('POST ') || text.startsWith('GET ')) {
            const resp = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nOK\n";
            socket.write(resp);
            socket.end();
            return;
        }
    });

    socket.on('error', (err) => {
        if (err.code !== 'ECONNRESET') {
            console.error(`Socket error from ${remote}:`, err.message);
        }
    });

    socket.setTimeout(30000);
    socket.on('timeout', () => {
        console.log(`⏱️ Socket timeout (30s) from ${remote}`);
        socket.end();
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`🚀 TimeWatch WAN/Cloud Listener active on 0.0.0.0:${PORT}`);
    console.log(`Waiting for ATF-305 (Cloud ID: C262AC269B1B3133)...`);
    console.log(`=======================================================\n`);
});
