Add-Type -AssemblyName System.Windows.Forms

$logFile = "d:\payfix\sync-agent\timewatch-live.log"

function Log-Message([string]$msg) {
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
}

"=== PAYFIX TIMEWATCH NATIVE SERVICE STARTED AT $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss')) ===" | Out-File -FilePath $logFile -Encoding utf8

$form = New-Object System.Windows.Forms.Form
$form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
$form.ShowInTaskbar = $false

$asm = [Reflection.Assembly]::LoadFrom("C:\iAS\AxInterop.RealSvrOcxTcpLib.dll")
$axCtrl = New-Object AxRealSvrOcxTcpLib.AxRealSvrOcxTcp
$form.Controls.Add($axCtrl)
$form.Show()

$global:LastPunches = @{}

function Handle-LogData($sender, $devIp, $devPort, $sn, $uId, $pDate, $ioMode, $vMode, $sourceEvent) {
    try {
        # ALWAYS send ACK so device clears its local state
        try {
            $sender.SendRtLogResponseV1($devIp, $devPort, $sn)
        } catch {}

        Log-Message "[$sourceEvent] Incoming Punch: UserID=$uId, Time=$pDate, SN=$sn"

        # STRICT FILTER: User 80 (aktestuser@testnet.in)
        if ("$uId" -ne "80") {
            return
        }

        # DEBOUNCE: Ignore duplicate event within 15 seconds
        $now = [DateTime]::UtcNow
        if ($global:LastPunches.ContainsKey("$uId")) {
            $diff = ($now - $global:LastPunches["$uId"]).TotalSeconds
            if ($diff -lt 15) {
                Log-Message "⏳ [DEBOUNCE] Duplicate event from $sourceEvent ignored for User $uId ($([Math]::Round($diff, 1))s since last punch)"
                return
            }
        }
        $global:LastPunches["$uId"] = $now

        Log-Message "🎯 [USER 80 MATCH!] aktestuser@testnet.in punched on $sn at $pDate"

        # Run node sync
        $nodeCmd = "node d:\payfix\sync-agent\sync-punch.js --userId 80 --timestamp `"$pDate`" --punchType $ioMode --deviceSerial `"$sn`""
        cmd.exe /c $nodeCmd | Out-File -FilePath $logFile -Append -Encoding utf8

    } catch {
        Log-Message "Error in Handle-LogData: $($_.Exception.Message)"
    }
}

# 1. OnReceiveGLogData
$handlerData = [AxRealSvrOcxTcpLib._DRealSvrOcxTcpEvents_OnReceiveGLogDataEventHandler]{
    param($sender, $e)
    $pDate = $e.anLogDate.ToString("yyyy-MM-ddTHH:mm:ss+05:30")
    Handle-LogData $sender $e.astrDeviceIP $e.anDevicePort $e.astrSerialNo $e.anSEnrollNumber $pDate $e.anInOutMode $e.anVerifyMode "OnReceiveGLogData"
}
$axCtrl.add_OnReceiveGLogData($handlerData)

# 2. OnReceiveGLogDataExtend (Face / Multifactor Terminal Event)
$handlerExtend = [AxRealSvrOcxTcpLib._DRealSvrOcxTcpEvents_OnReceiveGLogDataExtendEventHandler]{
    param($sender, $e)
    $pDate = $e.anLogDate.ToString("yyyy-MM-ddTHH:mm:ss+05:30")
    Handle-LogData $sender $e.astrDeviceIP $e.anDevicePort $e.astrSerialNo $e.anSEnrollNumber $pDate $e.anInOutMode $e.anVerifyMode "OnReceiveGLogDataExtend"
}
$axCtrl.add_OnReceiveGLogDataExtend($handlerExtend)

# 3. OnReceiveGLogText
$handlerText = [AxRealSvrOcxTcpLib._DRealSvrOcxTcpEvents_OnReceiveGLogTextEventHandler]{
    param($sender, $e)
    try {
        $logText = $e.astrLogText
        Log-Message "[OnReceiveGLogText] IP=$($e.astrClientIP), Text=$logText"
        if ($logText) {
            $parts = $logText -split "`t"
            if ($parts.Count -ge 2) {
                $uId = $parts[0].Trim()
                if ($uId -eq "80") {
                    $now = [DateTime]::UtcNow
                    if ($global:LastPunches.ContainsKey("$uId")) {
                        $diff = ($now - $global:LastPunches["$uId"]).TotalSeconds
                        if ($diff -lt 15) {
                            Log-Message "⏳ [DEBOUNCE] Duplicate text event ignored for User $uId"
                            return
                        }
                    }
                    $global:LastPunches["$uId"] = $now

                    $dateStr = $parts[1].Trim()
                    $ioMode = if ($parts.Count -gt 3) { [int]$parts[3] } else { 0 }
                    Log-Message "🎯 [USER 80 MATCH - TEXT] aktestuser@testnet.in punched at $dateStr"
                    $nodeCmd = "node d:\payfix\sync-agent\sync-punch.js --userId 80 --timestamp `"$dateStr`" --punchType $ioMode --deviceSerial `"TIPL596270523057`""
                    cmd.exe /c $nodeCmd | Out-File -FilePath $logFile -Append -Encoding utf8
                }
            }
        }
    } catch {
        Log-Message "Error in OnReceiveGLogText: $($_.Exception.Message)"
    }
}
$axCtrl.add_OnReceiveGLogText($handlerText)

# 4. OnReceiveGLogTextAndImage
$handlerTextImage = [AxRealSvrOcxTcpLib._DRealSvrOcxTcpEvents_OnReceiveGLogTextAndImageEventHandler]{
    param($sender, $e)
    try {
        $logText = $e.astrLogText
        Log-Message "[OnReceiveGLogTextAndImage] IP=$($e.astrClientIP), Text=$logText"
        if ($logText) {
            $parts = $logText -split "`t"
            if ($parts.Count -ge 2 -and $parts[0].Trim() -eq "80") {
                $now = [DateTime]::UtcNow
                if ($global:LastPunches.ContainsKey("80")) {
                    $diff = ($now - $global:LastPunches["80"]).TotalSeconds
                    if ($diff -lt 15) {
                        return
                    }
                }
                $global:LastPunches["80"] = $now

                $nodeCmd = "node d:\payfix\sync-agent\sync-punch.js --userId 80 --timestamp `"$($parts[1].Trim())`" --punchType 0 --deviceSerial `"TIPL596270523057`""
                cmd.exe /c $nodeCmd | Out-File -FilePath $logFile -Append -Encoding utf8
            }
        }
    } catch {}
}
$axCtrl.add_OnReceiveGLogTextAndImage($handlerTextImage)

$ret = $axCtrl.OpenNetwork(5005)
Log-Message "AxRealSvrOcxTcp OpenNetwork(5005) result: $ret"

Log-Message "=========================================================="
Log-Message "  PAYFIX TIMEWATCH ATF-305 SERVICE ACTIVE"
Log-Message "  Listening on: 192.168.1.25:5005"
Log-Message "  Employee Target: aktestuser@testnet.in (User ID: 80)"
Log-Message "  Tenant: PayFix Corporate (c3e28d92-e3ea-4fe0-8efd-927ce550b666)"
Log-Message "=========================================================="

[System.Windows.Forms.Application]::Run($form)
