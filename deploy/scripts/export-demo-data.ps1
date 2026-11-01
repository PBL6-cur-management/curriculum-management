# Exports the local ctdt_real database and attachment folder for the demo VM, then copies both there.
#   pwsh deploy/scripts/export-demo-data.ps1 -VmHost <ip>            # dump + upload
#   pwsh deploy/scripts/export-demo-data.ps1                         # dump only, to -OutDir
# The output holds real personal data: it goes straight to the VM over SSH and never into git or chat.
param(
  [string]$VmHost = '',
  [string]$Container = 'ctdt-postgres-1',
  [string]$Database = 'ctdt_real',
  [string]$User = 'ctdt',
  [string]$StorageRoot = (Join-Path $PSScriptRoot '..\..\source\backend\storage'),
  [string]$OutDir = (Join-Path ([IO.Path]::GetTempPath()) 'ctdt-demo-export'),
  [string]$SshKey = (Join-Path $HOME '.ssh\oci_ctdt')
)
$ErrorActionPreference = 'Stop'

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$dump = Join-Path $OutDir 'ctdt_real.dump'
$files = Join-Path $OutDir 'files.tgz'

Write-Host "==> pg_dump $Database từ container $Container"
docker exec $Container pg_dump -U $User -d $Database -Fc -f /tmp/ctdt_real.dump
if ($LASTEXITCODE) { throw 'pg_dump thất bại (container có đang chạy? pnpm services:up)' }
docker cp "${Container}:/tmp/ctdt_real.dump" $dump
docker exec $Container rm -f /tmp/ctdt_real.dump

if (Test-Path $StorageRoot) {
  Write-Host "==> Nén tệp đính kèm từ $StorageRoot"
  # Windows' own bsdtar: a Git Bash tar earlier on PATH reads "D:\..." as a remote host.
  $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
  & $tar -czf $files -C $StorageRoot .
  if ($LASTEXITCODE) { throw 'tar thất bại' }
} else {
  Write-Warning "Không có thư mục tệp $StorageRoot — chỉ xuất CSDL."
  $files = $null
}

Get-ChildItem $OutDir | Format-Table Name, Length

if ($VmHost) {
  Write-Host "==> Gửi lên ubuntu@${VmHost}:/srv/ctdt/incoming/"
  $targets = @($dump) + @($files | Where-Object { $_ })
  scp -i $SshKey @targets "ubuntu@${VmHost}:/srv/ctdt/incoming/"
  if ($LASTEXITCODE) { throw 'scp thất bại' }
  Write-Host 'Tiếp theo trên VM: /srv/ctdt/current/deploy/scripts/restore-demo-data.sh /srv/ctdt/incoming/ctdt_real.dump /srv/ctdt/incoming/files.tgz'
}
