const { exec } = require('child_process');
const os = require('os');

const platform = os.platform();

console.log('🧹 Cleaning up existing node processes...');

if (platform === 'win32') {
  // Windows: Kill all node processes
  exec('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH', (error, stdout) => {
    if (stdout && stdout.trim()) {
      exec('taskkill /F /IM node.exe /T', (killError) => {
        if (killError && killError.code !== 128) {
          console.log('⚠️  Some processes could not be killed (may be protected)');
        } else {
          console.log('✅ Cleaned up existing node processes');
        }
      });
    } else {
      console.log('✅ No node processes found to clean');
    }
  });
} else {
  // Unix-based: Kill processes on the port
  const port = process.env.PORT || 5001;
  exec(`lsof -ti:${port}`, (error, stdout) => {
    if (stdout && stdout.trim()) {
      exec(`kill -9 ${stdout.trim()}`, (killError) => {
        if (!killError) {
          console.log(`✅ Cleaned up port ${port}`);
        }
      });
    } else {
      console.log(`✅ Port ${port} is free`);
    }
  });
}
