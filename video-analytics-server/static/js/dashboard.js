/**
 * Video Analytics Server & NVR Dashboard JavaScript
 */

let activeTab = 'live-monitor';
let ws = null;
let eventCount = 0;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  loadCameras();
  loadStorageStats();
  loadVehicles();
  loadPersons();
  loadRecordings();
  loadVehicleLogs();
  loadFaceLogs();

  // Periodic poll for stats
  setInterval(loadStorageStats, 30000);
});

// ── Web Audio Synthesizer for Alerts (Zero external audio file dependency) ──
function playAudioChime(isGranted) {
  const chk = document.getElementById('chk-audio-alert');
  if (chk && !chk.checked) return;

  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (isGranted) {
      // Pleasant high two-tone chime (Entry Granted)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880.0, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } else {
      // Low dual warning buzzer (Entry Denied)
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220.0, audioCtx.currentTime); // A3
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    }
  } catch (e) {
    console.debug('Audio playback error:', e);
  }
}

// ── WebSocket Connection ───────────────────────────────────────────────────
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('Connected to Video Analytics WebSocket');
  };

  ws.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      handleLiveEvent(data);
    } catch (e) {
      console.error('Error parsing WS message:', e);
    }
  };

  ws.onclose = () => {
    console.warn('WS disconnected. Reconnecting in 3s...');
    setTimeout(initWebSocket, 3000);
  };
}

function handleLiveEvent(evt) {
  eventCount++;
  const counter = document.getElementById('event-counter');
  if (counter) counter.innerText = `${eventCount} Events`;

  const isGranted = evt.decision === 'GRANTED';
  playAudioChime(isGranted);

  // 1. Update Video Feed HUD
  const hud = document.getElementById('live-status-badge');
  if (hud) {
    hud.className = `px-4 py-2 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 ${
      isGranted ? 'bg-emerald-600/90 text-white border border-emerald-400' : 'bg-rose-600/90 text-white border border-rose-400'
    }`;
    hud.innerHTML = `
      <i class="fa-solid ${isGranted ? 'fa-circle-check text-base' : 'fa-triangle-exclamation text-base'}"></i>
      <div>
        <div class="uppercase tracking-wide">${evt.decision === 'GRANTED' ? 'ACCESS GRANTED' : 'ACCESS DENIED'}</div>
        <div class="text-[11px] font-normal opacity-90">${evt.plate_number ? 'Plate: ' + evt.plate_number : 'Face: ' + evt.person_name}</div>
      </div>
    `;
    hud.classList.remove('hidden');
    clearTimeout(hud._timer);
    hud._timer = setTimeout(() => hud.classList.add('hidden'), 4000);
  }

  // 2. Barrier animation indicator
  if (isGranted) {
    const barrier = document.getElementById('barrier-text');
    if (barrier) {
      barrier.innerText = 'OPENING BOOM BARRIER...';
      barrier.className = 'text-amber-400 font-extrabold animate-pulse';
      setTimeout(() => {
        barrier.innerText = 'GATE OPEN - PASS THROUGH';
        barrier.className = 'text-emerald-400 font-extrabold';
        setTimeout(() => {
          barrier.innerText = 'READY / ARMED';
          barrier.className = 'text-emerald-400 font-bold';
        }, 3000);
      }, 1200);
    }
  }

  // 3. Add Event Card to Live Activity Stream
  const container = document.getElementById('live-event-container');
  if (container) {
    // Remove empty placeholder
    if (container.querySelector('i.fa-satellite-dish')) {
      container.innerHTML = '';
    }

    const card = document.createElement('div');
    card.className = `event-card-new p-3 rounded-xl border text-xs flex gap-3 shadow transition ${
      isGranted
        ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-200'
        : 'bg-rose-950/40 border-rose-800/60 text-rose-200'
    }`;

    const snapImg = evt.snapshot_path
      ? `<img src="${evt.snapshot_path}" alt="Snap" class="w-14 h-14 object-cover rounded-lg border border-slate-700">`
      : `<div class="w-14 h-14 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500"><i class="fa-solid fa-camera"></i></div>`;

    const iconType = evt.type === 'plate_event' ? 'fa-car' : 'fa-user';
    const titleText = evt.plate_number ? `Plate: ${evt.plate_number}` : `Face: ${evt.person_name}`;
    const subText = evt.owner_name ? `Owner: ${evt.owner_name}` : (evt.similarity ? `Similarity: ${(evt.similarity*100).toFixed(1)}%` : '');

    card.innerHTML = `
      ${snapImg}
      <div class="flex-1">
        <div class="flex items-center justify-between">
          <span class="font-bold flex items-center gap-1.5 text-white">
            <i class="fa-solid ${iconType} text-indigo-400"></i> ${titleText}
          </span>
          <span class="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
            isGranted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
          }">${evt.decision}</span>
        </div>
        <p class="text-[11px] text-slate-400 mt-0.5">${subText}</p>
        <div class="flex items-center justify-between text-[10px] text-slate-500 mt-2">
          <span>${evt.timestamp || 'Just now'}</span>
          ${evt.event_clip_path ? `<a href="${evt.event_clip_path}" target="_blank" class="text-indigo-400 hover:underline"><i class="fa-solid fa-play"></i> Clip</a>` : ''}
        </div>
      </div>
    `;

    container.insertBefore(card, container.firstChild);

    // Limit to latest 30 cards in UI
    while (container.children.length > 30) {
      container.removeChild(container.lastChild);
    }
  }

  // Reload history tables if currently on that tab
  if (activeTab === 'vehicles') loadVehicleLogs();
  if (activeTab === 'faces') loadFaceLogs();
  if (activeTab === 'playback') loadRecordings();
}

function clearEventFeed() {
  const container = document.getElementById('live-event-container');
  if (container) {
    container.innerHTML = `
      <div class="text-center text-slate-500 py-16 text-xs">
        <i class="fa-solid fa-satellite-dish text-2xl mb-2 text-slate-600"></i>
        <p>Listening for camera detections...</p>
      </div>
    `;
  }
}

// ── Tab Switching ──────────────────────────────────────────────────────────
function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active', 'border-brand-500', 'text-brand-400');
    btn.classList.add('border-transparent', 'text-slate-400');
  });

  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));

  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'border-brand-500', 'text-brand-400');
    activeBtn.classList.remove('border-transparent', 'text-slate-400');
  }

  const activeContent = document.getElementById(`tab-${tabId}`);
  if (activeContent) {
    activeContent.classList.remove('hidden');
  }

  // Trigger data fetch on tab switch
  if (tabId === 'vehicles') { loadVehicles(); loadVehicleLogs(); }
  if (tabId === 'faces') { loadPersons(); loadFaceLogs(); }
  if (tabId === 'playback') { loadRecordings(); }
  if (tabId === 'cameras') { loadCameras(); }
  if (tabId === 'settings') { loadStorageStats(); }
}

// ── Live Stream Controls ───────────────────────────────────────────────────
function changeActiveStream(camId) {
  const img = document.getElementById('live-stream-img');
  const title = document.getElementById('current-stream-title');
  if (img) img.src = `/api/stream/${camId}?t=${Date.now()}`;
  if (title) title.innerText = `${camId} Live Stream`;
}

function refreshLiveStream() {
  const sel = document.getElementById('camera-selector');
  const camId = sel ? sel.value : 'cam_01';
  changeActiveStream(camId);
}

function manualOpenGate() {
  fetch('/api/gate/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'MANUAL_GUARD_OVERRIDE', entity_id: 'GUARD' })
  }).then(r => r.json()).then(data => {
    alert('Boom Barrier Emergency Open Triggered!');
  });
}

function triggerSecurityAlarm() {
  playAudioChime(false);
  alert('Security Alert Siren Sounded!');
}

// ── Vehicles (ANPR) API ────────────────────────────────────────────────────
function loadVehicles(search = '') {
  fetch(`/api/vehicles?search=${encodeURIComponent(search)}`)
    .then(r => r.json())
    .then(vehicles => {
      const tbody = document.getElementById('vehicles-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      if (vehicles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-slate-500">No registered vehicles found.</td></tr>`;
        return;
      }

      vehicles.forEach(v => {
        const isAllowed = v.access_status === 'ALLOWED';
        const badgeClass = isAllowed ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border-rose-500/30';
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-800/40 transition';
        row.innerHTML = `
          <td class="px-5 py-3 font-mono font-bold text-white text-sm">${v.plate_number}</td>
          <td class="px-5 py-3 text-slate-200">${v.owner_name}</td>
          <td class="px-5 py-3 text-slate-400">${v.vehicle_type || 'Car'}</td>
          <td class="px-5 py-3">
            <span class="px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${badgeClass}">
              ${v.access_status}
            </span>
          </td>
          <td class="px-5 py-3 text-slate-400">${v.notes || '-'}</td>
          <td class="px-5 py-3 text-right">
            <button onclick="deleteVehicle('${v.plate_number}')" class="text-rose-400 hover:text-rose-300 p-1.5 rounded hover:bg-rose-950/40 transition" title="Delete">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        `;
        tbody.appendChild(row);
      });
    });
}

function searchVehicles(val) {
  loadVehicles(val);
}

function submitVehicle(evt) {
  evt.preventDefault();
  const payload = {
    plate_number: document.getElementById('v-plate').value,
    owner_name: document.getElementById('v-owner').value,
    vehicle_type: document.getElementById('v-type').value,
    access_status: document.getElementById('v-status').value,
    notes: document.getElementById('v-notes').value
  };

  fetch('/api/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json()).then(() => {
    closeModal('modal-vehicle');
    document.getElementById('vehicle-form').reset();
    loadVehicles();
  });
}

function deleteVehicle(plate) {
  if (confirm(`Remove vehicle ${plate} from directory?`)) {
    fetch(`/api/vehicles/${plate}`, { method: 'DELETE' }).then(() => loadVehicles());
  }
}

function loadVehicleLogs() {
  fetch('/api/logs/vehicles?limit=25')
    .then(r => r.json())
    .then(logs => {
      const tbody = document.getElementById('vehicle-logs-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      logs.forEach(l => {
        const isGranted = l.access_status === 'GRANTED';
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-800/40 transition';
        row.innerHTML = `
          <td class="px-4 py-2.5 text-slate-400 text-[11px]">${l.timestamp}</td>
          <td class="px-4 py-2.5 font-mono font-bold text-white">${l.plate_number}</td>
          <td class="px-4 py-2.5 text-slate-300">${l.owner_name || 'Unknown'}</td>
          <td class="px-4 py-2.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
              isGranted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }">${l.access_status}</span>
          </td>
          <td class="px-4 py-2.5 text-slate-400">${(l.confidence * 100).toFixed(0)}%</td>
          <td class="px-4 py-2.5">
            ${l.snapshot_path ? `<a href="${l.snapshot_path}" target="_blank" class="text-indigo-400 hover:underline"><i class="fa-solid fa-image"></i> View</a>` : '-'}
          </td>
          <td class="px-4 py-2.5">
            ${l.event_clip_path ? `<a href="${l.event_clip_path}" target="_blank" class="text-brand-400 hover:underline"><i class="fa-solid fa-play"></i> Watch</a>` : '-'}
          </td>
        `;
        tbody.appendChild(row);
      });
    });
}

// ── Persons (Face Biometric) API ───────────────────────────────────────────
function loadPersons() {
  fetch('/api/persons')
    .then(r => r.json())
    .then(persons => {
      const grid = document.getElementById('persons-grid');
      if (!grid) return;
      grid.innerHTML = '';

      if (persons.length === 0) {
        grid.innerHTML = `<div class="col-span-4 text-center py-10 text-slate-500 text-xs">No registered members yet. Click "Enroll New Member" above.</div>`;
        return;
      }

      persons.forEach(p => {
        const isAllowed = p.access_status === 'ALLOWED';
        const card = document.createElement('div');
        card.className = 'bg-surface-900 border border-slate-800 p-4 rounded-2xl flex flex-col items-center text-center shadow-lg hover:border-slate-700 transition space-y-2';
        
        const photoUrl = p.photo_path || '/static/img/avatar_placeholder.png';

        card.innerHTML = `
          <div class="relative w-20 h-20 rounded-2xl overflow-hidden border-2 ${isAllowed ? 'border-emerald-500/60' : 'border-rose-500/60'} shadow-md">
            <img src="${photoUrl}" alt="${p.name}" class="w-full h-full object-cover">
          </div>
          <div class="w-full">
            <h4 class="font-bold text-sm text-white truncate">${p.name}</h4>
            <p class="text-[11px] text-slate-400">${p.role || 'Member'} ${p.employee_code ? '• ' + p.employee_code : ''}</p>
          </div>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
            isAllowed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
          }">${p.access_status}</span>
          <button onclick="deletePerson('${p.id}')" class="text-rose-400 hover:text-rose-300 text-xs pt-1 transition">
            <i class="fa-solid fa-trash-can mr-1"></i> Remove
          </button>
        `;
        grid.appendChild(card);
      });
    });
}

function submitPerson(evt) {
  evt.preventDefault();
  const fileInput = document.getElementById('p-photo');
  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Please select a photo');
    return;
  }

  const formData = new FormData();
  formData.append('name', document.getElementById('p-name').value);
  formData.append('employee_code', document.getElementById('p-code').value);
  formData.append('access_status', document.getElementById('p-status').value);
  formData.append('file', fileInput.files[0]);

  fetch('/api/persons/enroll', {
    method: 'POST',
    body: formData
  }).then(r => r.json()).then(data => {
    closeModal('modal-person');
    document.getElementById('person-form').reset();
    loadPersons();
  }).catch(err => {
    alert('Enrollment error: ' + err);
  });
}

function deletePerson(id) {
  if (confirm('Delete this person and revoke access?')) {
    fetch(`/api/persons/${id}`, { method: 'DELETE' }).then(() => loadPersons());
  }
}

function loadFaceLogs() {
  fetch('/api/logs/faces?limit=25')
    .then(r => r.json())
    .then(logs => {
      const tbody = document.getElementById('face-logs-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';

      logs.forEach(l => {
        const isGranted = l.access_status === 'GRANTED';
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-800/40 transition';
        row.innerHTML = `
          <td class="px-4 py-2.5 text-slate-400 text-[11px]">${l.timestamp}</td>
          <td class="px-4 py-2.5 font-bold text-white">${l.person_name}</td>
          <td class="px-4 py-2.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
              isGranted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
            }">${l.access_status}</span>
          </td>
          <td class="px-4 py-2.5 text-slate-300">${(l.similarity * 100).toFixed(1)}%</td>
          <td class="px-4 py-2.5">
            ${l.snapshot_path ? `<a href="${l.snapshot_path}" target="_blank" class="text-indigo-400 hover:underline"><i class="fa-solid fa-image"></i> Crop</a>` : '-'}
          </td>
          <td class="px-4 py-2.5">
            ${l.event_clip_path ? `<a href="${l.event_clip_path}" target="_blank" class="text-brand-400 hover:underline"><i class="fa-solid fa-play"></i> Watch</a>` : '-'}
          </td>
        `;
        tbody.appendChild(row);
      });
    });
}

// ── NVR Recordings Playback ────────────────────────────────────────────────
function loadRecordings() {
  const camFilter = document.getElementById('playback-camera-filter').value;
  const typeFilter = document.getElementById('playback-type-filter').value;

  let url = `/api/recordings?limit=50`;
  if (camFilter) url += `&camera_id=${encodeURIComponent(camFilter)}`;
  if (typeFilter === 'events') url += `&is_event=true`;
  if (typeFilter === 'continuous') url += `&is_event=false`;

  fetch(url)
    .then(r => r.json())
    .then(recs => {
      const countEl = document.getElementById('recordings-count');
      if (countEl) countEl.innerText = recs.length;

      const container = document.getElementById('recordings-list-container');
      if (!container) return;
      container.innerHTML = '';

      if (recs.length === 0) {
        container.innerHTML = `<div class="text-center py-12 text-slate-500 text-xs">No recordings found for current filter.</div>`;
        return;
      }

      recs.forEach(r => {
        const isEvent = r.is_event_clip === 1;
        const item = document.createElement('div');
        item.className = 'p-2.5 rounded-xl border border-slate-800 bg-surface-950/70 hover:border-brand-500 cursor-pointer transition text-xs flex items-center justify-between';
        item.onclick = () => playArchiveVideo(r);

        item.innerHTML = `
          <div>
            <div class="font-semibold text-slate-200 flex items-center gap-1.5">
              <i class="fa-solid ${isEvent ? 'fa-bolt text-amber-400' : 'fa-video text-brand-400'}"></i>
              ${r.camera_id} • ${isEvent ? 'Event Clip' : 'Segment'}
            </div>
            <div class="text-[10px] text-slate-400 mt-0.5">${r.start_time} (${r.duration_sec}s, ${r.file_size_mb} MB)</div>
          </div>
          <button class="text-brand-400 hover:text-brand-300 p-1.5"><i class="fa-solid fa-circle-play text-lg"></i></button>
        `;
        container.appendChild(item);
      });
    });
}

function playArchiveVideo(rec) {
  const player = document.getElementById('archive-video-player');
  const title = document.getElementById('player-title');
  const meta = document.getElementById('player-meta');
  const dl = document.getElementById('btn-download-video');

  if (player) {
    player.src = rec.file_path;
    player.load();
    player.play();
  }
  if (title) title.innerText = `${rec.camera_id} • ${rec.event_type} (${rec.duration_sec}s)`;
  if (meta) meta.innerText = `${rec.start_time} • ${rec.file_size_mb} MB`;
  if (dl) {
    dl.href = rec.file_path;
    dl.classList.remove('hidden');
  }
}

// ── Cameras Management ─────────────────────────────────────────────────────
function loadCameras() {
  fetch('/api/cameras')
    .then(r => r.json())
    .then(cameras => {
      // Update header stat
      const stat = document.getElementById('header-camera-stat');
      if (stat) stat.innerText = `${cameras.length} Active`;

      // Update selector in live tab
      const selector = document.getElementById('camera-selector');
      const playbackCamFilter = document.getElementById('playback-camera-filter');

      if (selector) {
        selector.innerHTML = '';
        cameras.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.innerText = `${c.id} - ${c.name}`;
          selector.appendChild(opt);
        });
      }

      if (playbackCamFilter) {
        playbackCamFilter.innerHTML = '<option value="">All Cameras</option>';
        cameras.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.innerText = c.name;
          playbackCamFilter.appendChild(opt);
        });
      }

      // Populate Cameras Tab Grid
      const grid = document.getElementById('cameras-grid');
      if (!grid) return;
      grid.innerHTML = '';

      cameras.forEach(c => {
        const card = document.createElement('div');
        card.className = 'bg-surface-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-3';
        card.innerHTML = `
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-sm text-white flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              ${c.name}
            </h4>
            <span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">${c.id}</span>
          </div>
          <div class="space-y-1 text-xs text-slate-400">
            <div><span class="text-slate-500">Stream:</span> <code class="text-indigo-300 text-[11px]">${c.stream_url}</code></div>
            <div><span class="text-slate-500">Location:</span> ${c.location || 'Gate'}</div>
            <div><span class="text-slate-500">Purpose:</span> ${c.purpose}</div>
            <div><span class="text-slate-500">Recording:</span> <span class="text-emerald-400 font-semibold">${c.recording_enabled ? 'Enabled (24/7)' : 'Disabled'}</span></div>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
            <button onclick="changeActiveStream('${c.id}'); switchTab('live-monitor');" class="text-brand-400 hover:underline">
              <i class="fa-solid fa-eye"></i> View Live
            </button>
            <div class="flex items-center gap-3">
              <button onclick="openEditCameraModal('${c.id}')" class="text-indigo-400 hover:text-indigo-300 transition">
                <i class="fa-solid fa-pen-to-square"></i> Edit
              </button>
              <button onclick="deleteCamera('${c.id}')" class="text-rose-400 hover:text-rose-300 transition">
                <i class="fa-solid fa-trash-can"></i> Remove
              </button>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
    });
}

function submitCamera(evt) {
  evt.preventDefault();
  const payload = {
    id: document.getElementById('c-id').value,
    name: document.getElementById('c-name').value,
    stream_url: document.getElementById('c-url').value,
    location: document.getElementById('c-loc').value,
    purpose: document.getElementById('c-purpose').value,
    recording_enabled: document.getElementById('c-recording').checked
  };

  fetch('/api/cameras', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json()).then(() => {
    closeModal('modal-camera');
    document.getElementById('camera-form').reset();
    loadCameras();
  });
}

function deleteCamera(camId) {
  if (confirm(`Delete camera ${camId}?`)) {
    fetch(`/api/cameras/${camId}`, { method: 'DELETE' }).then(() => loadCameras());
  }
}

// ── Edit Camera & ONVIF Functions ──────────────────────────────────────────
function openEditCameraModal(camId) {
  fetch(`/api/cameras/${camId}`)
    .then(r => r.json())
    .then(cam => {
      document.getElementById('edit-c-id').value = cam.id;
      document.getElementById('edit-c-id-display').value = cam.id;
      document.getElementById('edit-c-name').value = cam.name;
      document.getElementById('edit-c-url').value = cam.stream_url;
      document.getElementById('edit-c-loc').value = cam.location || '';
      document.getElementById('edit-c-purpose').value = cam.purpose || 'entry_gate';
      document.getElementById('edit-c-recording').checked = cam.recording_enabled === 1 || cam.recording_enabled === true;

      const statusDiv = document.getElementById('edit-stream-test-status');
      if (statusDiv) {
        statusDiv.className = 'hidden';
        statusDiv.innerHTML = '';
      }

      document.getElementById('modal-edit-camera').classList.remove('hidden');
    });
}

function submitEditCamera(evt) {
  evt.preventDefault();
  const camId = document.getElementById('edit-c-id').value;
  const payload = {
    name: document.getElementById('edit-c-name').value,
    stream_url: document.getElementById('edit-c-url').value,
    location: document.getElementById('edit-c-loc').value,
    purpose: document.getElementById('edit-c-purpose').value,
    recording_enabled: document.getElementById('edit-c-recording').checked
  };

  fetch(`/api/cameras/${camId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json()).then(res => {
    closeModal('modal-edit-camera');
    loadCameras();
    const selector = document.getElementById('camera-selector');
    if (selector && selector.value === camId) {
      changeActiveStream(camId);
    }
  });
}

function testStreamInput(inputId, statusDivId) {
  const url = document.getElementById(inputId).value;
  const statusDiv = document.getElementById(statusDivId);
  if (!url) {
    alert('Please enter a stream URL first.');
    return;
  }

  statusDiv.className = 'mt-1.5 text-[11px] p-2 rounded-lg bg-slate-800 text-indigo-300 flex items-center gap-2';
  statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting to RTSP stream...';
  statusDiv.classList.remove('hidden');

  fetch('/api/cameras/test-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stream_url: url })
  }).then(r => r.json()).then(res => {
    if (res.success) {
      statusDiv.className = 'mt-1.5 text-[11px] p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300';
      statusDiv.innerHTML = `
        <div class="font-bold flex items-center gap-1.5"><i class="fa-solid fa-circle-check"></i> ${res.message}</div>
        ${res.warning ? `<div class="text-[10px] text-amber-300 mt-0.5"><i class="fa-solid fa-triangle-exclamation"></i> ${res.warning}</div>` : ''}
      `;
      if (res.sanitized_url && res.sanitized_url !== url) {
        document.getElementById(inputId).value = res.sanitized_url;
      }
    } else {
      statusDiv.className = 'mt-1.5 text-[11px] p-2 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300';
      statusDiv.innerHTML = `
        <div class="font-bold flex items-center gap-1.5"><i class="fa-solid fa-circle-xmark"></i> ${res.message}</div>
        ${res.warning ? `<div class="text-[10px] text-amber-300 mt-0.5">${res.warning}</div>` : ''}
      `;
    }
  }).catch(err => {
    statusDiv.className = 'mt-1.5 text-[11px] p-2 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300';
    statusDiv.innerHTML = `Connection error: ${err}`;
  });
}

function switchAddCameraTab(mode) {
  const rtspTab = document.getElementById('btn-add-tab-rtsp');
  const onvifTab = document.getElementById('btn-add-tab-onvif');
  const rtspPanel = document.getElementById('add-camera-rtsp-panel');
  const onvifPanel = document.getElementById('add-camera-onvif-panel');

  if (mode === 'rtsp') {
    rtspTab.className = 'px-4 py-2 font-bold border-b-2 border-brand-500 text-brand-400 flex items-center gap-1.5';
    onvifTab.className = 'px-4 py-2 font-medium border-b-2 border-transparent text-slate-400 hover:text-white flex items-center gap-1.5';
    rtspPanel.classList.remove('hidden');
    onvifPanel.classList.add('hidden');
  } else {
    onvifTab.className = 'px-4 py-2 font-bold border-b-2 border-brand-500 text-brand-400 flex items-center gap-1.5';
    rtspTab.className = 'px-4 py-2 font-medium border-b-2 border-transparent text-slate-400 hover:text-white flex items-center gap-1.5';
    onvifPanel.classList.remove('hidden');
    rtspPanel.classList.add('hidden');
  }
}

function discoverOnvifDevices() {
  const container = document.getElementById('onvif-discovery-results');
  container.innerHTML = '<span class="text-indigo-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Broadcasting WS-Discovery probe across LAN...</span>';

  fetch('/api/onvif/discover')
    .then(r => r.json())
    .then(data => {
      if (!data.devices || data.devices.length === 0) {
        container.innerHTML = '<span class="text-amber-400"><i class="fa-solid fa-circle-exclamation mr-1"></i> No ONVIF multicast reply received. You can enter the Camera IP directly below.</span>';
        return;
      }

      container.innerHTML = `<span class="text-emerald-400 font-bold mb-1 block">Found ${data.devices.length} ONVIF device(s):</span>`;
      data.devices.forEach(d => {
        const item = document.createElement('div');
        item.className = 'flex items-center justify-between p-1.5 bg-surface-900 rounded border border-slate-800 mt-1';
        item.innerHTML = `
          <span><b>IP:</b> ${d.ip}</span>
          <button type="button" onclick="selectDiscoveredIp('${d.ip}')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded text-[10px]">
            Use this IP
          </button>
        `;
        container.appendChild(item);
      });
    }).catch(err => {
      container.innerHTML = `Discovery error: ${err}`;
    });
}

function selectDiscoveredIp(ip) {
  document.getElementById('onvif-ip').value = ip;
}

function fetchOnvifProfiles() {
  const ip = document.getElementById('onvif-ip').value;
  const port = parseInt(document.getElementById('onvif-port').value) || 80;
  const user = document.getElementById('onvif-user').value;
  const pass = document.getElementById('onvif-pass').value;

  if (!ip || !user) {
    alert('Please enter Camera IP and Username.');
    return;
  }

  const container = document.getElementById('onvif-streams-container');
  const list = document.getElementById('onvif-streams-list');
  container.classList.remove('hidden');
  list.innerHTML = '<div class="text-indigo-300 p-2"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Connecting via ONVIF SOAP & fetching media profiles...</div>';

  fetch('/api/onvif/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip: ip, port: port, username: user, password: pass })
  }).then(r => r.json()).then(data => {
    list.innerHTML = '';
    if (!data.streams || data.streams.length === 0) {
      list.innerHTML = '<div class="text-rose-400 p-2">Could not retrieve stream profiles. Check credentials and port.</div>';
      return;
    }

    data.streams.forEach(s => {
      const row = document.createElement('div');
      row.className = 'p-2 rounded bg-surface-900 border border-slate-800 flex items-center justify-between';
      row.innerHTML = `
        <div class="truncate mr-2">
          <div class="font-bold text-slate-200">${s.name}</div>
          <code class="text-[10px] text-slate-400 block truncate">${s.rtsp_url}</code>
        </div>
        <button type="button" onclick="applyOnvifStream('${s.rtsp_url}')" class="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap">
          Use This Stream
        </button>
      `;
      list.appendChild(row);
    });
  }).catch(err => {
    list.innerHTML = `<div class="text-rose-400 p-2">ONVIF error: ${err}</div>`;
  });
}

function applyOnvifStream(url) {
  document.getElementById('c-url').value = url;
  switchAddCameraTab('rtsp');
  testStreamInput('c-url', 'add-stream-test-status');
}

// ── Storage Stats & Settings ───────────────────────────────────────────────
function loadStorageStats() {
  fetch('/api/storage/stats')
    .then(r => r.json())
    .then(stats => {
      const headerStat = document.getElementById('header-disk-stat');
      if (headerStat) headerStat.innerText = `${stats.used_disk_percent}% used (${stats.free_disk_gb} GB free)`;

      const usedGb = document.getElementById('storage-used-gb');
      const totalGb = document.getElementById('storage-total-gb');
      const pctLabel = document.getElementById('storage-pct-label');
      const bar = document.getElementById('storage-progress-bar');

      if (usedGb) usedGb.innerText = `${stats.used_disk_gb} GB`;
      if (totalGb) totalGb.innerText = `${stats.total_disk_gb} GB`;
      if (pctLabel) pctLabel.innerText = `${stats.used_disk_percent}%`;
      if (bar) {
        bar.style.width = `${Math.min(stats.used_disk_percent, 100)}%`;
        if (stats.used_disk_percent > 85) {
          bar.className = 'bg-rose-500 h-full transition-all duration-500';
        } else {
          bar.className = 'bg-brand-500 h-full transition-all duration-500';
        }
      }

      const inputMax = document.getElementById('setting-max-disk');
      const inputRet = document.getElementById('setting-retention-days');
      if (inputMax && !inputMax.value) inputMax.value = stats.max_disk_usage_percent;
      if (inputRet && !inputRet.value) inputRet.value = stats.retention_days;
    });

  fetch('/api/settings')
    .then(r => r.json())
    .then(s => {
      const urlInput = document.getElementById('setting-relay-url');
      const threshInput = document.getElementById('setting-face-thresh');
      if (urlInput && !urlInput.value) urlInput.value = s.relay_webhook_url || '';
      if (threshInput && !threshInput.value) threshInput.value = s.face_similarity_threshold || 0.65;
    });
}

function saveStorageSettings(evt) {
  evt.preventDefault();
  const payload = {
    max_disk_usage_percent: parseFloat(document.getElementById('setting-max-disk').value),
    retention_days: parseInt(document.getElementById('setting-retention-days').value)
  };
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json()).then(() => alert('Storage settings saved!'));
}

function saveRelaySettings(evt) {
  evt.preventDefault();
  const payload = {
    relay_webhook_url: document.getElementById('setting-relay-url').value,
    face_similarity_threshold: parseFloat(document.getElementById('setting-face-thresh').value)
  };
  fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(r => r.json()).then(() => alert('Relay & AI settings saved!'));
}

// ── Test Simulator Triggers ────────────────────────────────────────────────
function openSimulatorModal() {
  document.getElementById('modal-simulator').classList.remove('hidden');
}

function simulateVehicle(plate) {
  fetch('/api/simulate/plate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plate_number: plate, camera_id: 'cam_01' })
  }).then(r => r.json()).then(data => {
    console.log('Simulated vehicle result:', data);
  });
}

function simulateFace(authorized) {
  fetch('/api/simulate/face', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ authorized: authorized, camera_id: 'cam_01' })
  }).then(r => r.json()).then(data => {
    console.log('Simulated face result:', data);
  });
}

// ── Modal Helper ───────────────────────────────────────────────────────────
function openAddVehicleModal() { document.getElementById('modal-vehicle').classList.remove('hidden'); }
function openAddPersonModal() { document.getElementById('modal-person').classList.remove('hidden'); }
function openAddCameraModal() { document.getElementById('modal-camera').classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
