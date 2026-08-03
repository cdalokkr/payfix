# Universal eSSL Biometric & Multi-Session Attendance Setup Guide

This guide provides complete instructions for configuring any **eSSL Biometric Attendance Device**, **Express Selfie Kiosk**, and **Multi-Session PWA/Mobile App** with PayFix.

---

## Supported eSSL Integration Methods

PayFix supports **ALL eSSL & ZKTeco models** through 4 universal integration adapters:

### 1. Method 1: ADMS Direct Cloud Push (`/api/biometric/iclock`)
*Best for: Modern eSSL machines with Wi-Fi / LAN / 4G SIM ADMS/WDMS firmware (e.g., SilkFP, K30, MB20, uFace, X990).*

#### Device Configuration Steps:
1. Open the Menu on your eSSL Device.
2. Go to **Comm. Settings** -> **Cloud Server / ADMS / Comm. Options**.
3. Enable **ADMS** / **Push Server**.
4. Set **Server IP / Domain**: `your-payfix-domain.com` (or IP address).
5. Set **Server Port**: `80` (or `443` for HTTPS).
6. Set **Push Server Path / URL**: `/api/biometric/iclock`.
7. Set **Device Serial Number**: Matches `serial_number` in PayFix Biometric Devices Settings.
8. Save and restart device. Punches will stream directly to PayFix in real time (< 2 seconds).

---

### 2. Method 2: LAN TCP/UDP Socket Gateway (`sync-agent`)
*Best for: Standalone LAN eSSL devices connected via local IP address without ADMS cloud firmware.*

#### Agent Configuration Steps:
1. Navigate to `sync-agent/` folder on an on-premise Windows PC or Linux server connected to the local eSSL machine network.
2. Configure `.env` file:
   ```env
   BIOMETRIC_IP=192.168.1.201
   BIOMETRIC_PORT=4370
   CLOUD_API_URL=https://your-payfix-domain.com/api/biometric/sync
   BIOMETRIC_API_KEY=your-tenant-biometric-api-key
   DEVICE_ID=ESSL-LAN-GATEWAY-01
   ```
3. Run `npm install` and start the daemon:
   ```bash
   node index.js
   ```
4. The agent listens for sub-second socket punch events over Port 4370 and streams them instantly to PayFix Cloud.

---

### 3. Method 3: eTimeTrackLite Desktop MS SQL Bridge (`essl-sql-bridge.js`)
*Best for: Enterprise setups running eSSL's official desktop software (`eTimeTrackLite`) on a local Windows PC.*

#### Bridge Setup:
1. Open `sync-agent/` folder.
2. Configure MS SQL credentials in `.env`:
   ```env
   MSSQL_HOST=localhost
   MSSQL_USER=sa
   MSSQL_PASSWORD=your-password
   MSSQL_DB=eTimeTrackLite1
   CLOUD_API_URL=https://your-payfix-domain.com/api/biometric/sync
   BIOMETRIC_API_KEY=your-tenant-biometric-api-key
   ```
3. Run `node essl-sql-bridge.js`.
4. The bridge polls `DeviceLogs` table every 60 seconds and pushes new punches to PayFix.

---

### 4. Method 4: USB Log File Import (`/api/biometric/usb-import`)
*Best for: Remote standalone eSSL machines without any network connectivity.*

1. Insert USB Pen Drive into eSSL machine.
2. Export Attendance Logs to USB (`.dat` / `.csv` file).
3. Open PayFix Admin Dashboard -> **Biometric Devices** -> **Import USB Log File**.
4. Upload file for bulk log ingestion.

---

## Express Selfie Kiosk Setup (Entrance Tablet App)

1. Open PayFix on an iPad or Android Tablet mounted at the office entrance.
2. Navigate to **Kiosk Terminal Mode** (`ExpressKioskApp`).
3. Click **Start Always-On Kiosk**.
4. The tablet caches face vectors for **ALL employees** locally in IndexedDB.
5. **Offline Mode**: Operates 100% offline if Wi-Fi drops. Punches queue in IndexedDB and auto-flush to cloud when internet resumes.

---

## Universal Multiple Check-In / Check-Out Sessions

- Employees can check in and out multiple times per day across PWA App, Mobile App, Kiosk, or eSSL machines.
- Daily total working hours are automatically computed as the sum of all completed session durations:
  $$\text{Total Hours} = \sum (\text{Check-Out}_i - \text{Check-In}_i)$$
- All sessions are audited with timestamps, device location tags, and verification logs.
