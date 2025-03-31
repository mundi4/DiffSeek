# index.html 파일 경로 설정
$indexFile = "index.html"
$content = Get-Content $indexFile -Raw  # 전체 내용 읽기

# 새로운 HTML 콘텐츠 초기화
$newContent = ""

# 각 줄을 확인하며 처리
foreach ($line in $content -split "`n") {
    # <script> 태그 처리
    if ($line -match '<script.*src="(.*?)".*>') {
        $src = $matches[1]
        Write-Host "Found <script> tag with src: $src"
        
        # 외부 스크립트 파일 읽어서 <script> 태그 안에 내용 삽입
        if (Test-Path $src) {
            $scriptContent = Get-Content $src -Raw
            $scriptTag = "<script id='$src'>`n$scriptContent`n</script>"
            $newContent += $scriptTag + "`n"
        } else {
            Write-Host "Warning: $src not found"
        }
    }
    # <link> 태그 처리
    elseif ($line -match '<link.*href="(.*?)".*>') {
        $href = $matches[1]
        Write-Host "Found <link> tag with href: $href"
        
        # 외부 CSS 파일 읽어서 <style> 태그로 변환
        if (Test-Path $href) {
            $styleContent = Get-Content $href -Raw
            $styleTag = "<style>`n$styleContent`n</style>"
            $newContent += $styleTag + "`n"
        } else {
            Write-Host "Warning: $href not found"
        }
    }
    else {
        # 나머지 HTML 내용은 그대로 추가
        $newContent += $line + "`n"
    }
}

# 새로운 HTML 파일로 저장
$newContent | Set-Content "diffseek.html"
Write-Host "New HTML file saved as diffseek.html"
