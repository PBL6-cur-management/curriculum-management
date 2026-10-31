# F-27 BE-07. Chạy preflight rồi k6. Không bao giờ chạy trên dữ liệu thật.
#   .\Invoke-LoadTest.ps1 -Profile canonical -BaseUrl https://host -Manifest m.json -Credentials c.json -Output D:\evidence\k6
param(
  [Parameter(Mandatory)][ValidateSet('canonical', 'staff-smoke')][string]$Profile,
  [Parameter(Mandatory)][string]$BaseUrl,
  [Parameter(Mandatory)][string]$Manifest,
  [Parameter(Mandatory)][string]$Credentials,
  [Parameter(Mandatory)][string]$Output
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

node (Join-Path $here 'preflight.mjs') --profile $Profile --manifest $Manifest --credentials $Credentials --base-url $BaseUrl
if ($LASTEXITCODE -ne 0) { throw 'Preflight thất bại; không chạy k6.' }

New-Item -ItemType Directory -Force -Path $Output | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$env:BASE_URL = $BaseUrl
$env:PROFILE = $Profile
$env:MANIFEST_PATH = (Resolve-Path $Manifest).Path
$env:CREDENTIALS_PATH = (Resolve-Path $Credentials).Path
try {
  k6 run --summary-export (Join-Path $Output "summary-$Profile-$stamp.json") (Join-Path $here 'f27-read-only.js')
  $code = $LASTEXITCODE
} finally {
  Remove-Item Env:CREDENTIALS_PATH -ErrorAction SilentlyContinue
}
exit $code
