const { execFile } = require('child_process');
const os = require('os');

const port = String(process.env.PORT || 5001);

const finish = (message) => {
  if (message) console.log(message);
};

if (os.platform() === 'win32') {
  execFile('netstat', ['-ano', '-p', 'tcp'], (error, stdout) => {
    if (error) return finish(`Port ${port} is free`);

    const processIds = stdout
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts[1] === `0.0.0.0:${port}` || parts[1] === `[::]:${port}`)
      .map((parts) => parts[4])
      .filter(Boolean);

    if (processIds.length === 0) return finish(`Port ${port} is free`);

    execFile('taskkill', ['/F', '/T', '/PID', processIds[0]], (killError) => {
      finish(killError ? `Could not release port ${port}` : `Released port ${port}`);
    });
  });
} else {
  execFile('sh', ['-c', `lsof -ti:${port}`], (error, stdout) => {
    if (error || !stdout.trim()) return finish(`Port ${port} is free`);
    execFile('kill', ['-9', stdout.trim()], () => finish(`Released port ${port}`));
  });
}