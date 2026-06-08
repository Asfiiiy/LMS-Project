# PowerShell script to copy TinyMCE files to public directory
# Run this after npm install if TinyMCE files are missing

Write-Host "📦 Copying TinyMCE files to public directory..." -ForegroundColor Cyan

# Remove existing tinymce folder if it exists
if (Test-Path "public\tinymce") {
    Write-Host "   Removing old TinyMCE files..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "public\tinymce"
}

# Create public/tinymce directory
Write-Host "   Creating public/tinymce directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "public\tinymce" | Out-Null

# Copy TinyMCE files
Write-Host "   Copying files from node_modules..." -ForegroundColor Yellow
Copy-Item -Recurse -Force "node_modules\tinymce\*" "public\tinymce\"

Write-Host "✅ TinyMCE files copied successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Files copied to: public\tinymce\" -ForegroundColor Cyan
Write-Host "🚀 You can now use TinyMCE without API key!" -ForegroundColor Green


