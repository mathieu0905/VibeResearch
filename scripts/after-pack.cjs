/**
 * electron-builder afterPack hook
 * Injects .prisma/client into asar from extraResources.
 *
 * electron-builder ignores hidden directories (starting with .) in the files config,
 * so we copy .prisma to _prisma, then use extraResources to include it outside asar,
 * and finally inject it back into asar as .prisma.
 */

const fs = require('fs');
const path = require('path');

module.exports = async function (context) {
  const appOutDir = context.appOutDir;
  const platform = context.electronPlatformName;

  // Determine the asar path based on platform
  let asarPath, resourcesPath;
  if (platform === 'darwin') {
    // macOS: app.asar is inside the .app bundle
    const appName = context.packager.appInfo.productFilename;
    resourcesPath = path.join(appOutDir, `${appName}.app`, 'Contents', 'Resources');
    asarPath = path.join(resourcesPath, 'app.asar');
  } else if (platform === 'win32') {
    // Windows: app.asar is in resources folder
    resourcesPath = path.join(appOutDir, 'resources');
    asarPath = path.join(resourcesPath, 'app.asar');
  } else {
    // Linux: app.asar is in resources folder
    resourcesPath = path.join(appOutDir, 'resources');
    asarPath = path.join(resourcesPath, 'app.asar');
  }

  if (!fs.existsSync(asarPath)) {
    console.log(`[afterPack] asar not found at ${asarPath}, skipping`);
    return;
  }

  console.log(`[afterPack] Processing asar: ${asarPath}`);

  // Path to prisma-backup from extraResources
  const prismaBackupPath = path.join(resourcesPath, 'prisma-backup');

  if (!fs.existsSync(prismaBackupPath)) {
    console.log(`[afterPack] prisma-backup not found at ${prismaBackupPath}, skipping`);
    return;
  }

  console.log(`[afterPack] Found prisma-backup at ${prismaBackupPath}`);

  // Use asar library to extract, modify, and repack
  const asar = require('@electron/asar');
  const tmpDir = path.join(context.outDir, 'asar-temp');

  // Extract asar
  console.log('[afterPack] Extracting asar...');
  asar.extractAll(asarPath, tmpDir);

  // Copy prisma-backup to node_modules/.prisma in the extracted asar
  const targetPath = path.join(tmpDir, 'node_modules', '.prisma');
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.cpSync(prismaBackupPath, targetPath, { recursive: true });

  console.log('[afterPack] Injected .prisma into asar');

  // Repack asar
  console.log('[afterPack] Repacking asar...');
  fs.unlinkSync(asarPath);
  await asar.createPackage(tmpDir, asarPath);

  // Cleanup temp directory
  console.log('[afterPack] Cleaning up temp directory...');
  fs.rmSync(tmpDir, { recursive: true, force: true });

  // Also remove the prisma-backup from resources since it's now in asar
  console.log('[afterPack] Removing prisma-backup from resources...');
  fs.rmSync(prismaBackupPath, { recursive: true, force: true });

  console.log('[afterPack] Done!');
};
