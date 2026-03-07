// scripts/build-assets.ts — Asset pipeline CI script (T047)
// Compress sprites, generate atlas, hash filenames, produce manifest.

import { readdir, readFile, writeFile, mkdir, copyFile, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { createHash } from 'crypto';

const ASSETS_SRC = 'assets-src';
const ASSETS_OUT = 'public/assets';

interface AssetManifest {
  sprites: Record<string, string>;
  audio: Record<string, string>;
  fonts: Record<string, string>;
  generatedAt: string;
}

async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  const hash = createHash('md5').update(content).digest('hex').slice(0, 8);
  return hash;
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // Already exists
  }
}

async function processDirectory(
  srcDir: string,
  outDir: string,
  category: string,
): Promise<Record<string, string>> {
  const manifest: Record<string, string> = {};

  try {
    const files = await readdir(srcDir);

    for (const file of files) {
      const srcPath = join(srcDir, file);
      const fileStat = await stat(srcPath);
      if (!fileStat.isFile()) continue;

      const ext = extname(file);
      const name = basename(file, ext);
      const hash = await hashFile(srcPath);
      const hashedName = `${name}.${hash}${ext}`;
      const outPath = join(outDir, hashedName);

      await copyFile(srcPath, outPath);
      manifest[file] = `assets/${hashedName}`;

      console.log(`[Assets] ${category}: ${file} → ${hashedName}`);
    }
  } catch {
    console.log(`[Assets] No ${category} source files found in ${srcDir}`);
  }

  return manifest;
}

async function buildAssets(): Promise<void> {
  console.log('[Assets] Starting asset pipeline...');

  await ensureDir(ASSETS_OUT);

  const manifest: AssetManifest = {
    sprites: await processDirectory(
      join(ASSETS_SRC, 'sprites'),
      ASSETS_OUT,
      'sprites',
    ),
    audio: await processDirectory(
      join(ASSETS_SRC, 'audio'),
      ASSETS_OUT,
      'audio',
    ),
    fonts: await processDirectory(
      join(ASSETS_SRC, 'fonts'),
      ASSETS_OUT,
      'fonts',
    ),
    generatedAt: new Date().toISOString(),
  };

  await writeFile(
    join(ASSETS_OUT, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  console.log('[Assets] Pipeline complete. Manifest written to public/assets/manifest.json');
}

buildAssets().catch((err) => {
  console.error('[Assets] Pipeline failed:', err);
  process.exit(1);
});
