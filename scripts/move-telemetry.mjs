import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const sourceDir = path.join(rootDir, 'temp');
const targetDir = path.join(rootDir, 'src', 'components', 'features', 'telemetry');

async function moveTelemetryFiles() {
  try {
    await fs.mkdir(targetDir, { recursive: true });
    
    const files = ['TacticalTelemetryCard.tsx', 'TelemetryDetailsClient.tsx'];
    
    for (const file of files) {
      await fs.rename(path.join(sourceDir, file), path.join(targetDir, file));
      console.log(`[SUCCESS] Moved: ${file} -> ${targetDir}`);
    }
    
    const remaining = await fs.readdir(sourceDir);
    if (remaining.length === 0) {
      await fs.rmdir(sourceDir);
      console.log(`[SUCCESS] Removed empty directory: ${sourceDir}`);
    }
  } catch (err) {
    console.error(`[ERROR] Failed to move files:`, err.message);
  }
}

moveTelemetryFiles();