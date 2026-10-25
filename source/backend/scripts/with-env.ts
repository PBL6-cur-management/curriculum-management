import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'dotenv';

const [envFile, ...command] = process.argv.slice(2);
if (!envFile || command.length === 0) {
  console.error(
    'Usage: tsx scripts/with-env.ts <env-file> <command> [args...]',
  );
  process.exit(2);
}

let fileValues: ReturnType<typeof parse>;
try {
  fileValues = parse(readFileSync(envFile));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
    console.error(
      `Không tìm thấy ${envFile}. Hãy sao chép từ ${envFile}.example.`,
    );
    process.exit(1);
  }
  throw error;
}

// dotenv/config không ghi đè biến đã có; @nestjs/config ưu tiên biến môi trường hơn tệp mặc định.
const child = spawn(command.join(' '), {
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, ...fileValues },
});
child.once('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
child.once('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
