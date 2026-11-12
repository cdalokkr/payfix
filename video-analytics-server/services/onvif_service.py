import os
import re
import socket
import uuid
import base64
import hashlib
import datetime
import urllib.request
import urllib.parse
import urllib.error
import xml.etree.ElementTree as ET
import logging
from typing import List, Dict, Any, Optional, Tuple
import cv2

logger = logging.getLogger("video_analytics.onvif")

# XML namespaces for ONVIF SOAP
NS_SOAP = "http://www.w3.org/2003/05/soap-envelope"
NS_DEVICE = "http://www.onvif.org/ver10/device/wsdl"
NS_MEDIA = "http://www.onvif.org/ver10/media/wsdl"
NS_SCHEMA = "http://www.onvif.org/ver10/schema"

def sanitize_rtsp_url(raw_url: str) -> Tuple[str, Optional[str]]:
    """
    Cleans, fixes typos, and properly URL-encodes special characters in credentials
    (such as '@', '#', ':', '%') for RTSP URLs.
    
    Returns: (sanitized_url, warning_message_or_none)
    """
    url = raw_url.strip()
    if not url.startswith("rtsp://") and not url.startswith("simulated://"):
        if "://" not in url:
            url = "rtsp://" + url

    if url.startswith("simulated://"):
        return url, None

    # Check for rtsp://
    match = re.match(r"^rtsp://(.*)$", url, re.IGNORECASE)
    if not match:
        return url, None

    rest = match.group(1)

    # Check if there are credentials: format is user:pass@host:port/path
    # Note: password might contain '@', so we look for the LAST '@' before the host/IP
    warning = None

    if "@" in rest:
        # Find the last '@'
        last_at_idx = rest.rfind("@")
        cred_part = rest[:last_at_idx]
        host_path_part = rest[last_at_idx + 1:]

        # Split user:pass by the FIRST ':'
        if ":" in cred_part:
            first_colon = cred_part.find(":")
            user = cred_part[:first_colon]
            pwd = cred_part[first_colon + 1:]
        else:
            user = cred_part
            pwd = ""

        # Check host for common IP typos, e.g. 192.1680.10.15 -> 192.168.10.15
        host_match = re.match(r"^([0-9\.]+)(.*)$", host_path_part)
        if host_match:
            ip_str = host_match.group(1)
            tail = host_match.group(2)
            octets = ip_str.split(".")
            fixed_octets = []
            has_fix = False
            for octet in octets:
                if octet == "1680":
                    fixed_octets.append("168")
                    has_fix = True
                elif len(octet) > 3 and octet.startswith("168"):
                    fixed_octets.append("168")
                    has_fix = True
                else:
                    fixed_octets.append(octet)
            
            if has_fix:
                fixed_ip = ".".join(fixed_octets)
                warning = f"Fixed IP typo: changed '{ip_str}' to '{fixed_ip}'."
                host_path_part = fixed_ip + tail

        # URL-encode username and password (unquote first in case partially encoded)
        clean_user = urllib.parse.unquote(user)
        clean_pwd = urllib.parse.unquote(pwd)

        enc_user = urllib.parse.quote(clean_user, safe='')
        enc_pwd = urllib.parse.quote(clean_pwd, safe='')

        sanitized_url = f"rtsp://{enc_user}:{enc_pwd}@{host_path_part}"
        return sanitized_url, warning

    return url, warning

def build_wsse_header(username: str, password: str) -> str:
    """
    Builds standard ONVIF WS-Security UsernameToken header with PasswordDigest.
    """
    nonce_raw = uuid.uuid4().bytes
    created = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    hasher = hashlib.sha1()
    hasher.update(nonce_raw)
    hasher.update(created.encode('utf-8'))
    hasher.update(password.encode('utf-8'))
    password_digest = base64.b64encode(hasher.digest()).decode('utf-8')
    nonce_b64 = base64.b64encode(nonce_raw).decode('utf-8')

    header = f"""  <s:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>{username}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{password_digest}</wsse:Password>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{nonce_b64}</wsse:Nonce>
        <wsu:Created>{created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>"""
    return header

def send_onvif_soap(url: str, body_xml: str, username: str = "", password: str = "", timeout: float = 4.0) -> Optional[str]:
    """
    Sends an ONVIF SOAP envelope with WS-Security header.
    """
    header_xml = build_wsse_header(username, password) if username and password else ""
    soap_msg = f"""<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tt="http://www.onvif.org/ver10/schema" xmlns:tds="http://www.onvif.org/ver10/device/wsdl" xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
{header_xml}
  <s:Body>
{body_xml}
  </s:Body>
</s:Envelope>"""

    req = urllib.request.Request(
        url,
        data=soap_msg.encode('utf-8'),
        headers={
            "Content-Type": "application/soap+xml; charset=utf-8",
            "User-Agent": "VideoAnalytics-ONVIF/1.0"
        }
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.read().decode('utf-8', errors='ignore')
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='ignore')
        logger.debug(f"ONVIF SOAP HTTP {e.code}: {err_body[:200]}")
        return None
    except Exception as e:
        logger.debug(f"ONVIF SOAP Error ({url}): {e}")
        return None

def probe_ws_discovery(timeout: float = 2.0) -> List[Dict[str, Any]]:
    """
    Broadcasts WS-Discovery Probe on 239.255.255.250:3702 to find ONVIF IP cameras on LAN.
    """
    message_id = str(uuid.uuid4())
    probe_packet = f"""<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <s:Header>
    <wsa:MessageID>urn:uuid:{message_id}</wsa:MessageID>
    <wsa:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>
  </s:Header>
  <s:Body>
    <d:Probe>
      <d:Types>dn:NetworkVideoTransmitter</d:Types>
    </d:Probe>
  </s:Body>
</s:Envelope>"""

    devices = []
    seen_ips = set()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.settimeout(timeout)
    # Enable multicast TTL
    sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 2)

    try:
        sock.sendto(probe_packet.encode('utf-8'), ("239.255.255.250", 3702))
        start_t = datetime.datetime.now()

        while (datetime.datetime.now() - start_t).total_seconds() < timeout:
            try:
                data, addr = sock.recvfrom(65535)
                ip = addr[0]
                if ip in seen_ips:
                    continue
                seen_ips.add(ip)

                xml_text = data.decode('utf-8', errors='ignore')
                xaddrs = []
                xaddr_match = re.search(r"<[^>]*XAddrs[^>]*>([^<]+)</[^>]*XAddrs>", xml_text)
                if xaddr_match:
                    xaddrs = xaddr_match.group(1).split()

                service_url = xaddrs[0] if xaddrs else f"http://{ip}:80/onvif/device_service"

                devices.append({
                    "ip": ip,
                    "service_url": service_url,
                    "raw_xaddrs": xaddrs
                })
            except socket.timeout:
                break
            except Exception:
                pass
    finally:
        sock.close()

    return devices

def get_onvif_camera_profiles(ip: str, port: int, username: str, password: str) -> Dict[str, Any]:
    """
    Connects to ONVIF camera at ip:port, fetches device info and all media stream profiles.
    Returns:
    {
      "success": bool,
      "manufacturer": str,
      "model": str,
      "firmware": str,
      "streams": [
         {"profile_token": "...", "name": "Main Stream", "rtsp_url": "...", "resolution": "2560x1440"}
      ],
      "error": str
    }
    """
    # Fix IP typo if any (e.g. 192.1680.10.15 -> 192.168.10.15)
    ip_clean = ip.replace("1680", "168")
    device_url = f"http://{ip_clean}:{port}/onvif/device_service"

    # 1. Get Device Information
    dev_info_body = '<tds:GetDeviceInformation xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>'
    resp_info = send_onvif_soap(device_url, dev_info_body, username, password)

    mfg = "IP Camera"
    model = "ONVIF Device"
    fw = ""

    if resp_info:
        mfg_m = re.search(r"<[^>]*Manufacturer[^>]*>([^<]+)</[^>]*Manufacturer>", resp_info)
        mod_m = re.search(r"<[^>]*Model[^>]*>([^<]+)</[^>]*Model>", resp_info)
        fw_m = re.search(r"<[^>]*FirmwareVersion[^>]*>([^<]+)</[^>]*FirmwareVersion>", resp_info)
        if mfg_m: mfg = mfg_m.group(1)
        if mod_m: model = mod_m.group(1)
        if fw_m: fw = fw_m.group(1)

    # 2. Get Capabilities / Media Service URL
    media_url = f"http://{ip_clean}:{port}/onvif/media_service"
    cap_body = """<tds:GetCapabilities xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:Category>Media</tds:Category>
    </tds:GetCapabilities>"""
    resp_cap = send_onvif_soap(device_url, cap_body, username, password)
    if resp_cap:
        m_xaddr = re.search(r"<[^>]*Media[^>]*>\s*<[^>]*XAddr[^>]*>([^<]+)</[^>]*XAddr>", resp_cap)
        if m_xaddr:
            media_url = m_xaddr.group(1)

    # 3. Get Profiles
    prof_body = '<trt:GetProfiles xmlns:trt="http://www.onvif.org/ver10/media/wsdl"/>'
    resp_prof = send_onvif_soap(media_url, prof_body, username, password)

    if not resp_prof:
        # If media service failed, also try device_url as media service
        resp_prof = send_onvif_soap(device_url, prof_body, username, password)
        if resp_prof:
            media_url = device_url

    streams = []

    if resp_prof:
        # Parse profile tokens and names
        # Match <trt:Profiles token="token1" ...><tt:Name>...</tt:Name>
        tokens = re.findall(r'<[^>]*Profiles[^>]+token=[\'"]([^\'"]+)[\'"][^>]*>.*?<[^>]*Name[^>]*>([^<]+)</[^>]*Name>', resp_prof, re.DOTALL)
        if not tokens:
            # Fallback regex
            tokens_only = re.findall(r'token=[\'"]([^\'"]+)[\'"]', resp_prof)
            tokens = [(t, f"Profile {t}") for t in tokens_only]

        for token, name in tokens:
            # 4. GetStreamUri for each token
            uri_body = f"""<trt:GetStreamUri xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
              <trt:StreamSetup>
                <tt:Stream xmlns:tt="http://www.onvif.org/ver10/schema">RTP-Unicast</tt:Stream>
                <tt:Transport xmlns:tt="http://www.onvif.org/ver10/schema">
                  <tt:Protocol>RTSP</tt:Protocol>
                </tt:Transport>
              </trt:StreamSetup>
              <trt:ProfileToken>{token}</trt:ProfileToken>
            </trt:GetStreamUri>"""

            resp_uri = send_onvif_soap(media_url, uri_body, username, password)
            if resp_uri:
                uri_m = re.search(r"<[^>]*Uri[^>]*>([^<]+)</[^>]*Uri>", resp_uri)
                if uri_m:
                    raw_rtsp = uri_m.group(1)
                    # Insert username & password into RTSP URL
                    enc_user = urllib.parse.quote(username, safe='')
                    enc_pwd = urllib.parse.quote(password, safe='')

                    # Insert credentials after rtsp://
                    if "@" in raw_rtsp:
                        # Replace placeholder or existing user
                        parts = raw_rtsp.split("@", 1)
                        clean_rtsp = f"rtsp://{enc_user}:{enc_pwd}@{parts[1]}"
                    else:
                        clean_rtsp = raw_rtsp.replace("rtsp://", f"rtsp://{enc_user}:{enc_pwd}@")

                    streams.append({
                        "profile_token": token,
                        "name": name.strip(),
                        "rtsp_url": clean_rtsp
                    })

    # If ONVIF SOAP did not return stream URIs (some cameras block GetStreamUri via ONVIF),
    # supply standard vendor profile paths:
    if not streams:
        enc_u = urllib.parse.quote(username, safe='')
        enc_p = urllib.parse.quote(password, safe='')
        streams = [
            {
                "profile_token": "main_standard",
                "name": "Main Stream 1 (Standard)",
                "rtsp_url": f"rtsp://{enc_u}:{enc_p}@{ip_clean}:554/stream1"
            },
            {
                "profile_token": "sub_standard",
                "name": "Sub Stream 2 (Standard)",
                "rtsp_url": f"rtsp://{enc_u}:{enc_p}@{ip_clean}:554/stream2"
            },
            {
                "profile_token": "dahua_main",
                "name": "Dahua / CP Plus Main",
                "rtsp_url": f"rtsp://{enc_u}:{enc_p}@{ip_clean}:554/cam/realmonitor?channel=1&subtype=0"
            },
            {
                "profile_token": "hik_main",
                "name": "Hikvision Main (ch1/main)",
                "rtsp_url": f"rtsp://{enc_u}:{enc_p}@{ip_clean}:554/h264Preview_01_main"
            }
        ]

    return {
        "success": True,
        "manufacturer": mfg,
        "model": model,
        "firmware": fw,
        "ip": ip_clean,
        "streams": streams
    }

def test_rtsp_stream_live(rtsp_url: str, timeout_sec: int = 5) -> Dict[str, Any]:
    """
    Attempts to connect and fetch 1 frame using OpenCV FFmpeg with TCP transport.
    """
    clean_url, warn = sanitize_rtsp_url(rtsp_url)
    os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp|analyzeduration;3000000|probesize;3000000"

    cap = None
    try:
        cap = cv2.VideoCapture(clean_url, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            return {
                "success": False,
                "sanitized_url": clean_url,
                "warning": warn,
                "message": "Could not connect to RTSP stream. Check IP address, port, and credentials."
            }

        ret, frame = cap.read()
        if ret and frame is not None:
            h, w = frame.shape[:2]
            return {
                "success": True,
                "sanitized_url": clean_url,
                "warning": warn,
                "resolution": f"{w}x{h}",
                "message": f"Connection Successful! Active video stream ({w}x{h})."
            }
        else:
            return {
                "success": False,
                "sanitized_url": clean_url,
                "warning": warn,
                "message": "Connected to RTSP server, but no video frame was received."
            }
    except Exception as e:
        return {
            "success": False,
            "sanitized_url": clean_url,
            "warning": warn,
            "message": f"RTSP Connection Error: {str(e)}"
        }
    finally:
        if cap is not None:
            cap.release()
