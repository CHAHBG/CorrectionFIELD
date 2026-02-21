/**
 * @deprecated v2 initializes via `infra/db/LocalDB.init()` called from stores.
 * Asset copying is no longer needed — data comes from Supabase.
 */

import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { Database } from '../data/sources/Database';

export class StartupService {
    static async init() {
        console.log('Starting app initialization...');

        // 1. Ensure data directory exists in Documents
        const dataPath = `${RNFS.DocumentDirectoryPath}/data`;
        if (!await RNFS.exists(dataPath)) {
            await RNFS.mkdir(dataPath);
        }

        // 2. Recursive copy of assets/data to Documents/data
        // Since react-native-fs copyFileAssets is file-by-file on Android (no dir support usually),
        // we might need a manual list if we can't list assets easily.
        // BUT we can list assets using RNFS.readDirAssets('data') on Android!

        if (Platform.OS === 'android') {
            await this.copyAssetsRecursively('data', dataPath);
        }

        // 3. Init DB
        await Database.getInstance().init();

        console.log('Initialization complete');
    }

    private static async copyAssetsRecursively(assetPath: string, destPath: string) {
        try {
            const items = await RNFS.readDirAssets(assetPath);
            for (const item of items) {
                const destItemPath = `${destPath}/${item.name}`;

                if (item.isDirectory()) {
                    if (!await RNFS.exists(destItemPath)) {
                        await RNFS.mkdir(destItemPath);
                    }
                    await this.copyAssetsRecursively(item.path, destItemPath);
                } else {
                    // It's a file
                    if (!await RNFS.exists(destItemPath)) {
                        await RNFS.copyFileAssets(item.path, destItemPath);
                        console.log(`Copied ${item.path} to ${destItemPath}`);
                    }
                }
            }
        } catch (e) {
            console.error(`Failed to copy assets from ${assetPath}`, e);
        }
    }
}


