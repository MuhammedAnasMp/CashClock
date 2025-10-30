@echo off
echo 🚀 Installing latest CashClock build on all connected devices...
set APK_PATH=android\app\build\outputs\apk\debug\app-debug.apk

for /f "skip=1 tokens=1" %%A in ('adb devices') do (
    if NOT "%%A"=="" (
        echo 📱 Installing on device %%A ...
        adb -s %%A install -r %APK_PATH%
        echo ✅ Installed on %%A
    )
)
echo 🎉 Done!
pause
