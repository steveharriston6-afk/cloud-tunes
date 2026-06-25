import net from 'net';
import { spawn } from 'child_process';

const PORT = parseInt(process.argv[2] || '3001');
const COMMAND = process.argv[3];
const COMMAND_ARGS = process.argv.slice(4);

function waitForPort(port, cb) {
  const socket = net.connect(port, '127.0.0.1', () => {
    socket.destroy();
    cb();
  });
  socket.on('error', () => {
    socket.destroy();
    setTimeout(() => waitForPort(port, cb), 500);
  });
}

if (COMMAND) {
  waitForPort(PORT, () => {
    const child = spawn(COMMAND, COMMAND_ARGS, { stdio: 'inherit', shell: true });
    child.on('exit', (code) => process.exit(code ?? 0));
  });
} else {
  waitForPort(PORT, () => process.exit(0));
}
