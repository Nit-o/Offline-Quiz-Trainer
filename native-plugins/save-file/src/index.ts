import { registerPlugin } from '@capacitor/core';
import type { SaveFilePlugin } from './definitions';
import { SaveFileWeb } from './web';

const SaveFile = registerPlugin<SaveFilePlugin>('SaveFile', {
  web: new SaveFileWeb(),
});

export * from './definitions';
export { SaveFile };
