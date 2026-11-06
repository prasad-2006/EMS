# VTS API Verification Audit Script
# Tests key endpoints across all phases

$apiBaseUrl = "http://localhost:5001/api"
$serverBaseUrl = "http://localhost:5001"
$results = @()

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Description,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [switch]$UseServerBase
    )
    
    try {
        $base = if ($UseServerBase) { $serverBaseUrl } else { $apiBaseUrl }
        $uri = "$base$Endpoint"
        $params = @{
            Uri = $uri
            Method = $Method
            UseBasicParsing = $true
            TimeoutSec = 3
        }
        if ($Headers.Count -gt 0) { $params.Headers = $Headers }
        if ($null -ne $Body) {
            $params.ContentType = 'application/json'
            $params.Body = ($Body | ConvertTo-Json -Depth 5)
        }
        
        $response = Invoke-WebRequest @params
        $status = "OK $($response.StatusCode)"
    }
    catch {
        $status = if ($_.Exception.Response) { "WARN $($_.Exception.Response.StatusCode)" } else { "FAIL No Response" }
    }
    
    return [PSCustomObject]@{
        Method = $Method
        Endpoint = $Endpoint
        Status = $status
        Description = $Description
    }
}

function Add-TestResult {
    param(
        [string]$Phase,
        [string]$Method,
        [string]$Endpoint,
        [string]$Description,
        [hashtable]$Headers = @{},
        [object]$Body = $null,
        [switch]$UseServerBase
    )

    $result = Test-Endpoint -Method $Method -Endpoint $Endpoint -Description $Description -Headers $Headers -Body $Body -UseServerBase:$UseServerBase
    $script:results += [PSCustomObject]@{
        Phase = $Phase
        Method = $result.Method
        Endpoint = $result.Endpoint
        Status = $result.Status
        Description = $result.Description
    }
}

Write-Host "-----------------------------------------------------------" -ForegroundColor Cyan
Write-Host "VTS API VERIFICATION AUDIT - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "-----------------------------------------------------------" -ForegroundColor Cyan

Add-TestResult -Phase "PHASE 1" -Method GET -Endpoint "/health" -Description "API Health Check" -UseServerBase
Add-TestResult -Phase "PHASE 1" -Method POST -Endpoint "/auth/login" -Description "Login Endpoint" -Body @{ email = "invalid@example.com"; password = "invalid" }
Add-TestResult -Phase "PHASE 1" -Method POST -Endpoint "/auth/register" -Description "Register Endpoint" -Body @{ name = "API Audit"; email = "audit@example.com"; password = "audit123"; role = "employee" }

Add-TestResult -Phase "PHASE 2" -Method GET -Endpoint "/leave/all" -Description "Get All Leaves"
Add-TestResult -Phase "PHASE 2" -Method GET -Endpoint "/policies/default" -Description "Get Default Policy"
Add-TestResult -Phase "PHASE 2" -Method GET -Endpoint "/holidays" -Description "Get Holidays"

Add-TestResult -Phase "PHASE 3" -Method GET -Endpoint "/handover/covering" -Description "Get Covering Tasks"

Add-TestResult -Phase "PHASE 4" -Method GET -Endpoint "/leave/summary" -Description "Leave Summary"

Add-TestResult -Phase "PHASE 5" -Method GET -Endpoint "/notifications?page=1&limit=5" -Description "Get Notifications"

Add-TestResult -Phase "PHASE 6" -Method GET -Endpoint "/analytics/workforce/dashboard" -Description "Workforce Dashboard"
Add-TestResult -Phase "PHASE 6" -Method GET -Endpoint "/analytics/reports/utilization" -Description "Leave Utilization Report"

Write-Host ""
$results | Sort-Object Phase, Endpoint | Format-Table -AutoSize

Write-Host ""
Write-Host "-----------------------------------------------------------" -ForegroundColor Cyan
Write-Host "SUMMARY: Most protected endpoints should return WARN 401 without token." -ForegroundColor Green
Write-Host "Only /health is expected to return OK 200 anonymously." -ForegroundColor Green
Write-Host "-----------------------------------------------------------" -ForegroundColor Cyan
