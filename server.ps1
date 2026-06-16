$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8089/")
$listener.Start()
Write-Host "Server started on http://localhost:8089/"

# Run for 5 minutes (300 seconds) then stop
$startTime = Get-Date

try {
    while ($listener.IsListening) {
        # Check timeout to prevent infinite background run
        if (((Get-Date) - $startTime).TotalSeconds -gt 600) {
            Write-Host "Timeout reached. Stopping server."
            break
        }
        
        # Get context asynchronously to avoid blocking if we want to cancel
        $contextTask = $listener.GetContextAsync()
        while (-not $contextTask.IsCompleted) {
            Start-Sleep -Milliseconds 100
            if (((Get-Date) - $startTime).TotalSeconds -gt 600) { break }
        }
        if (-not $contextTask.IsCompleted) { break }
        
        $context = $contextTask.Result
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/index.html"
        }
        
        # Sanitize path to prevent directory traversal
        $sanitizedPath = $urlPath.Replace("..", "").Replace("\", "/")
        $filePath = Join-Path "c:\Users\4-410-1\Desktop\test" $sanitizedPath.Substring(1)
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # Set content types correctly
            if ($filePath.EndsWith(".html")) {
                $response.ContentType = "text/html; charset=utf-8"
            }
            elseif ($filePath.EndsWith(".css")) {
                $response.ContentType = "text/css; charset=utf-8"
            }
            elseif ($filePath.EndsWith(".js")) {
                $response.ContentType = "application/javascript; charset=utf-8"
            }
            elseif ($filePath.EndsWith(".png")) {
                $response.ContentType = "image/png"
            }
            
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = "404 Not Found: " + $filePath
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        $response.Close()
    }
} finally {
    $listener.Stop()
    Write-Host "Server stopped."
}
