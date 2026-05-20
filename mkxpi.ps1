Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$src = "C:\Users\Sandra\Codes\smm\dist"
$dst = "C:\Users\Sandra\Codes\smm\smart-mail-manager.xpi"

if (Test-Path $dst) { Remove-Item $dst }
[System.IO.Compression.ZipFile]::CreateFromDirectory($src, $dst, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Write-Host "XPI created at $dst"
