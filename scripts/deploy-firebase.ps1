param(
  [string]$ProjectId = $env:FIREBASE_PROJECT_ID,
  [string]$ProjectDisplayName = "MujahizIQ",
  [string]$Location = "nam5",
  [string]$DisplayName = "Mujahiz IQ",
  [string]$WebAppName = "Mujahiz IQ Web",
  [string]$Token = $env:FIREBASE_TOKEN
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

$NodeDir = Join-Path $Root ".tools\node-v24.17.0-win-x64"
if (Test-Path -LiteralPath $NodeDir) {
  $env:PATH = "$NodeDir;$env:PATH"
}

$Npx = Join-Path $NodeDir "npx.cmd"
if (-not (Test-Path -LiteralPath $Npx)) {
  $Npx = "npx"
}

if ($Token) {
  $env:FIREBASE_TOKEN = $Token
}

function Invoke-Firebase {
  & $Npx firebase @args
  if ($LASTEXITCODE -ne 0) {
    throw "Firebase CLI failed: firebase $($args -join ' ')"
  }
}

function ConvertFrom-FirebaseJsonOutput {
  param([object[]]$Output)

  $text = ($Output | Out-String).Trim()
  $start = $text.IndexOf("{")
  if ($start -lt 0) {
    throw "Firebase CLI did not return JSON output."
  }

  return $text.Substring($start) | ConvertFrom-Json
}

function Find-ValueInJson {
  param(
    [object]$Json,
    [string]$PropertyName
  )

  $serialized = $Json | ConvertTo-Json -Depth 30
  $pattern = '"' + [regex]::Escape($PropertyName) + '"\s*:\s*"([^"]+)"'
  if ($serialized -match $pattern) {
    return $Matches[1]
  }
  return ""
}

function Get-ProjectFromFirebaserc {
  $path = Join-Path $Root ".firebaserc"
  if (-not (Test-Path -LiteralPath $path)) {
    return ""
  }

  try {
    $config = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    if ($config.projects.default) {
      return [string]$config.projects.default
    }
  } catch {
    return ""
  }

  return ""
}

function Get-ProjectFromServiceAccount {
  $path = $env:GOOGLE_APPLICATION_CREDENTIALS
  if (-not $path -or -not (Test-Path -LiteralPath $path)) {
    return ""
  }

  try {
    $json = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    if ($json.project_id) {
      return [string]$json.project_id
    }
  } catch {
    return ""
  }

  return ""
}

function Get-ExistingProjectId {
  $output = & $Npx firebase projects:list --json 2>&1
  if ($LASTEXITCODE -ne 0) {
    return ""
  }

  try {
    $json = ConvertFrom-FirebaseJsonOutput $output
    $serialized = $json | ConvertTo-Json -Depth 30
    if ($ProjectDisplayName -and $serialized -match '"displayName"\s*:\s*"' + [regex]::Escape($ProjectDisplayName) + '"[\s\S]*?"projectId"\s*:\s*"([^"]+)"') {
      return $Matches[1]
    }
    if ($ProjectDisplayName -and $serialized -match '"projectId"\s*:\s*"([^"]+)"[\s\S]*?"displayName"\s*:\s*"' + [regex]::Escape($ProjectDisplayName) + '"') {
      return $Matches[1]
    }
    foreach ($candidate in @("mujahiz-iq-alani", "mujahiz-iq-260619", "mujahiz-iq-20260619")) {
      if ($serialized -match '"' + [regex]::Escape($candidate) + '"') {
        return $candidate
      }
    }
  } catch {
    return ""
  }

  return ""
}

function Ensure-FirebaseLogin {
  if ($Token -or $env:GOOGLE_APPLICATION_CREDENTIALS) {
    return
  }

  $loginOutput = & $Npx firebase login:list 2>&1
  if ($LASTEXITCODE -eq 0 -and (($loginOutput | Out-String) -notmatch "No authorized accounts")) {
    return
  }

  Write-Host ""
  Write-Host "Firebase login is required. Complete the browser/device-code flow in this window."
  Write-Host ""
  & $Npx firebase login --no-localhost
  if ($LASTEXITCODE -ne 0) {
    throw "Firebase login was not completed."
  }
}

function Ensure-Project {
  if ($ProjectId) {
    return $ProjectId
  }

  $existingFromFile = Get-ProjectFromFirebaserc
  if ($existingFromFile) {
    return $existingFromFile
  }

  $existingFromServiceAccount = Get-ProjectFromServiceAccount
  if ($existingFromServiceAccount) {
    return $existingFromServiceAccount
  }

  $existingFromAccount = Get-ExistingProjectId
  if ($existingFromAccount) {
    return $existingFromAccount
  }

  foreach ($candidate in @("mujahiz-iq-alani", "mujahiz-iq-260619", "mujahiz-iq-20260619")) {
    Write-Host "Trying to create Firebase project: $candidate"
    $createOutput = & $Npx firebase projects:create $candidate --display-name $DisplayName --non-interactive 2>&1
    if ($LASTEXITCODE -eq 0) {
      return $candidate
    }
    Write-Host ($createOutput | Out-String)
  }

  throw "Could not create a Firebase project. Set FIREBASE_PROJECT_ID and run this script again."
}

function Ensure-FirestoreDatabase {
  param([string]$ResolvedProjectId)

  $output = & $Npx firebase firestore:databases:create "(default)" --location $Location --project $ResolvedProjectId --non-interactive 2>&1
  if ($LASTEXITCODE -eq 0) {
    return
  }

  $text = $output | Out-String
  if ($text -match "already exists" -or $text -match "ALREADY_EXISTS") {
    return
  }

  Write-Warning "Firestore database creation did not complete automatically. Deployment will continue."
  Write-Warning $text
}

function Ensure-WebApp {
  param([string]$ResolvedProjectId)

  $listOutput = & $Npx firebase apps:list WEB --project $ResolvedProjectId --json 2>&1
  if ($LASTEXITCODE -eq 0) {
    try {
      $listJson = ConvertFrom-FirebaseJsonOutput $listOutput
      $serialized = $listJson | ConvertTo-Json -Depth 30
      if ($serialized -match '"displayName"\s*:\s*"' + [regex]::Escape($WebAppName) + '"[\s\S]*?"appId"\s*:\s*"([^"]+)"') {
        return $Matches[1]
      }
      $firstAppId = Find-ValueInJson $listJson "appId"
      if ($firstAppId) {
        return $firstAppId
      }
    } catch {
      Write-Warning "Could not parse apps:list output. A new web app will be created."
    }
  }

  $createOutput = & $Npx firebase apps:create WEB $WebAppName --project $ResolvedProjectId --json 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($createOutput | Out-String)
  }

  $createJson = ConvertFrom-FirebaseJsonOutput $createOutput
  $appId = Find-ValueInJson $createJson "appId"
  if (-not $appId) {
    throw "Could not read the created Firebase Web App ID."
  }
  return $appId
}

function Write-ProductionEnv {
  param(
    [string]$ResolvedProjectId,
    [string]$AppId
  )

  $configOutput = & $Npx firebase apps:sdkconfig WEB $AppId --project $ResolvedProjectId --json 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($configOutput | Out-String)
  }

  $configJson = ConvertFrom-FirebaseJsonOutput $configOutput
  $configText = $configJson | ConvertTo-Json -Depth 30
  $apiKey = Find-ValueInJson $configJson "apiKey"
  $authDomain = Find-ValueInJson $configJson "authDomain"
  $projectIdValue = Find-ValueInJson $configJson "projectId"
  $storageBucket = Find-ValueInJson $configJson "storageBucket"
  $messagingSenderId = Find-ValueInJson $configJson "messagingSenderId"
  $appIdValue = Find-ValueInJson $configJson "appId"

  if (-not $projectIdValue) {
    $projectIdValue = $ResolvedProjectId
  }
  if (-not $authDomain) {
    $authDomain = "$ResolvedProjectId.firebaseapp.com"
  }
  if (-not $storageBucket) {
    $storageBucket = "$ResolvedProjectId.appspot.com"
  }
  if (-not $apiKey -or -not $appIdValue) {
    throw "Firebase SDK config is incomplete: $configText"
  }

  $envLines = @(
    "VITE_FIREBASE_API_KEY=$apiKey",
    "VITE_FIREBASE_AUTH_DOMAIN=$authDomain",
    "VITE_FIREBASE_PROJECT_ID=$projectIdValue",
    "VITE_FIREBASE_STORAGE_BUCKET=$storageBucket",
    "VITE_FIREBASE_MESSAGING_SENDER_ID=$messagingSenderId",
    "VITE_FIREBASE_APP_ID=$appIdValue"
  )

  Set-Content -LiteralPath (Join-Path $Root ".env.production") -Value $envLines -Encoding utf8
}

function Write-Firebaserc {
  param([string]$ResolvedProjectId)

  $content = @{
    projects = @{
      default = $ResolvedProjectId
    }
  } | ConvertTo-Json -Depth 5

  Set-Content -LiteralPath (Join-Path $Root ".firebaserc") -Value $content -Encoding utf8
}

function Build-Production {
  $configs = @("vite.config.js", "vite.config.ts")
  $renamed = @()
  try {
    foreach ($config in $configs) {
      if (Test-Path -LiteralPath $config) {
        $target = "$config.sandbox-hidden"
        Move-Item -LiteralPath $config -Destination $target -Force
        $renamed += [pscustomobject]@{ Source = $target; Destination = $config }
      }
    }

    & $Npx tsc -b
    if ($LASTEXITCODE -ne 0) {
      throw "TypeScript build failed."
    }

    & $Npx vite build --logLevel info
    if ($LASTEXITCODE -ne 0) {
      throw "Vite build failed."
    }
  } finally {
    foreach ($pair in $renamed) {
      if (Test-Path -LiteralPath $pair.Source) {
        Move-Item -LiteralPath $pair.Source -Destination $pair.Destination -Force
      }
    }
  }
}

Ensure-FirebaseLogin
$resolvedProjectId = Ensure-Project
Write-Host "Using Firebase project: $resolvedProjectId"

Ensure-FirestoreDatabase $resolvedProjectId
$appId = Ensure-WebApp $resolvedProjectId
Write-ProductionEnv $resolvedProjectId $appId
Write-Firebaserc $resolvedProjectId
Build-Production
Invoke-Firebase deploy --only hosting,firestore:rules,firestore:indexes --project $resolvedProjectId --non-interactive

Write-Host ""
Write-Host "Firebase Hosting URL: https://$resolvedProjectId.web.app"
Write-Host "Firebase Console: https://console.firebase.google.com/project/$resolvedProjectId"
Write-Host ""
Write-Host "If users cannot register, enable Email/Password in Authentication providers:"
Write-Host "https://console.firebase.google.com/project/$resolvedProjectId/authentication/providers"
