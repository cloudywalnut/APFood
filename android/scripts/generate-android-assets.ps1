Add-Type -AssemblyName System.Drawing

$scriptDir = $PSScriptRoot
$repoRoot = (Resolve-Path "$scriptDir\..\..").Path
$brandDir = "$repoRoot\public\brand"
$resDir = "$repoRoot\android\app\src\main\res"

$monoImg = [System.Drawing.Bitmap]::FromFile("$brandDir\ap-monogram-v2.png")
$wordImg = [System.Drawing.Bitmap]::FromFile("$brandDir\apfoods-wordmark-v1.png")

$ivory = [System.Drawing.ColorTranslator]::FromHtml("#fffefa")
$espresso = [System.Drawing.ColorTranslator]::FromHtml("#3b2a1e")

function New-Graphics($bitmap) {
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    return $g
}

# 1. Launcher Foregrounds
$foregrounds = @{
    "mipmap-mdpi" = 108
    "mipmap-hdpi" = 162
    "mipmap-xhdpi" = 216
    "mipmap-xxhdpi" = 324
    "mipmap-xxxhdpi" = 432
}

foreach ($kv in $foregrounds.GetEnumerator()) {
    $folder = $kv.Key
    $size = $kv.Value
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = New-Graphics $bmp
    $g.Clear([System.Drawing.Color]::Transparent)
    
    # Safe area is ~66% of adaptive icon size
    $iconSize = [int]($size * 0.65)
    $offset = [int](($size - $iconSize) / 2)
    $g.DrawImage($monoImg, $offset, $offset, $iconSize, $iconSize)
    $g.Dispose()
    
    $outPath = "$resDir\$folder\ic_launcher_foreground.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Saved $outPath"
}

# 2. Legacy Launcher Icons (Square)
$legacyIcons = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
}

foreach ($kv in $legacyIcons.GetEnumerator()) {
    $folder = $kv.Key
    $size = $kv.Value
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = New-Graphics $bmp
    $g.Clear($ivory)
    
    $iconSize = [int]($size * 0.72)
    $offset = [int](($size - $iconSize) / 2)
    $g.DrawImage($monoImg, $offset, $offset, $iconSize, $iconSize)
    $g.Dispose()
    
    $outPath = "$resDir\$folder\ic_launcher.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Saved $outPath"
}

# 3. Round Launcher Icons
foreach ($kv in $legacyIcons.GetEnumerator()) {
    $folder = $kv.Key
    $size = $kv.Value
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = New-Graphics $bmp
    $g.Clear([System.Drawing.Color]::Transparent)
    
    $brush = New-Object System.Drawing.SolidBrush($ivory)
    $g.FillEllipse($brush, 0, 0, $size, $size)
    $brush.Dispose()
    
    $iconSize = [int]($size * 0.68)
    $offset = [int](($size - $iconSize) / 2)
    $g.DrawImage($monoImg, $offset, $offset, $iconSize, $iconSize)
    $g.Dispose()
    
    $outPath = "$resDir\$folder\ic_launcher_round.png"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Saved $outPath"
}

# 4. Splash Screens
$splashes = @{
    "drawable\splash.png" = @(480, 320)
    "drawable-land-mdpi\splash.png" = @(480, 320)
    "drawable-land-hdpi\splash.png" = @(800, 480)
    "drawable-land-xhdpi\splash.png" = @(1280, 720)
    "drawable-land-xxhdpi\splash.png" = @(1600, 960)
    "drawable-land-xxxhdpi\splash.png" = @(1920, 1280)
    "drawable-port-mdpi\splash.png" = @(320, 480)
    "drawable-port-hdpi\splash.png" = @(480, 800)
    "drawable-port-xhdpi\splash.png" = @(720, 1280)
    "drawable-port-xxhdpi\splash.png" = @(960, 1600)
    "drawable-port-xxxhdpi\splash.png" = @(1280, 1920)
}

foreach ($kv in $splashes.GetEnumerator()) {
    $relPath = $kv.Key
    $w = $kv.Value[0]
    $h = $kv.Value[1]
    
    $bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = New-Graphics $bmp
    $g.Clear($ivory)
    
    $minDim = [Math]::Min($w, $h)
    $monoSize = [int]($minDim * 0.22)
    $wordWidth = [int]($minDim * 0.52)
    $wordHeight = [int]($wordWidth * (724.0 / 2172.0))
    $spacing = [int]($minDim * 0.03)
    $totalHeight = $monoSize + $spacing + $wordHeight
    $startY = [int](($h - $totalHeight) / 2)
    
    # Draw monogram centered
    $monoX = [int](($w - $monoSize) / 2)
    $g.DrawImage($monoImg, $monoX, $startY, $monoSize, $monoSize)
    
    # Draw wordmark centered below monogram
    $wordX = [int](($w - $wordWidth) / 2)
    $wordY = $startY + $monoSize + $spacing
    $g.DrawImage($wordImg, $wordX, $wordY, $wordWidth, $wordHeight)
    
    $g.Dispose()
    
    $outPath = "$resDir\$relPath"
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Saved $outPath ($w x $h)"
}

$monoImg.Dispose()
$wordImg.Dispose()
Write-Output "All brand assets generated successfully!"
