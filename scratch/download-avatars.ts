import fs from 'fs';
import path from 'path';

async function downloadAndInspect() {
    const oldUrl = "https://hkbbybkeatrtdbqfurtc.supabase.co/storage/v1/object/public/avatars/profile-f451aa9f-fce8-4450-a0a1-676268e337ac-1786365614821.jpg";
    const newPendingUrl = "https://hkbbybkeatrtdbqfurtc.supabase.co/storage/v1/object/public/avatars/profile-f451aa9f-fce8-4450-a0a1-676268e337ac-1786814386020.jpg";

    const scratchDir = path.join(process.cwd(), 'scratch');
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

    const oldPath = path.join(scratchDir, 'old_avatar.jpg');
    const newPath = path.join(scratchDir, 'new_pending_avatar.jpg');

    console.log('Downloading old avatar...');
    const oldRes = await fetch(oldUrl);
    const oldBuf = Buffer.from(await oldRes.arrayBuffer());
    fs.writeFileSync(oldPath, oldBuf);
    console.log(`Old Avatar: ${oldBuf.length} bytes saved to ${oldPath}`);

    console.log('Downloading new pending avatar...');
    const newRes = await fetch(newPendingUrl);
    const newBuf = Buffer.from(await newRes.arrayBuffer());
    fs.writeFileSync(newPath, newBuf);
    console.log(`New Pending Avatar: ${newBuf.length} bytes saved to ${newPath}`);
}

downloadAndInspect();
