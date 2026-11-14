import { registerPlugin } from '@capacitor/core';
import type { FolderImportPlugin } from './definitions';
import { FolderImportWeb } from './web';

const FolderImport = registerPlugin<FolderImportPlugin>('FolderImport', {
  web: new FolderImportWeb(),
});

export * from './definitions';
export { FolderImport };