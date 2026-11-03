# Uso: .\install.ps1 -ExtensionId <ID que muestra chrome://extensions>
param([Parameter(Mandatory)][string]$ExtensionId)

$dir  = $PSScriptRoot
$py   = (Get-Command python -ErrorAction Stop).Source
$name = 'com.pedro.ipresolver'

Set-Content -Path "$dir\host.bat" -Value "@echo off`r`n`"$py`" `"$dir\host.py`"" -Encoding ascii

$manifest = [ordered]@{
  name            = $name
  description     = 'Resolver DNS del sistema'
  path            = "$dir\host.bat"
  type            = 'stdio'
  allowed_origins = @("chrome-extension://$ExtensionId/")
} | ConvertTo-Json
Set-Content -Path "$dir\$name.json" -Value $manifest -Encoding ascii

foreach ($vendor in 'Google\Chrome', 'Microsoft\Edge') {
  $key = "HKCU:\Software\$vendor\NativeMessagingHosts\$name"
  New-Item -Path $key -Force | Out-Null
  Set-ItemProperty -Path $key -Name '(default)' -Value "$dir\$name.json"
}
Write-Host "Host nativo instalado. Reinicia el navegador."
