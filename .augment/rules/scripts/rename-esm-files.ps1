# rename-esm-files.ps1
Get-ChildItem -Recurse -Filter *.js | ForEach-Object {
  $content = Get-Content $_.FullName
  if ($content -match '^\s*(import|export)') {
    $newName = $_.FullName -replace '\.js$', '.mjs'
    Rename-Item $_.FullName $newName
    Write-Host "Renamed: $($_.FullName) -> $newName"
  }
}
