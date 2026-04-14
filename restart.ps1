$conns = Get-NetTCPConnection -LocalPort 3009 -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  if ($c.OwningProcess -gt 0) {
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Seconds 1
$env:NODE_ENV = "test"
& "C:\Program Files\nodejs\node.exe" "D:\chatbot\server\server.js"
