import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
    createPinappAgent,
    LocationFromIp,
    Weather,
} from '@pinapp-io/harness';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templateDir = join(__dirname, 'template');
const template = JSON.parse(readFileSync(join(templateDir, 'template.json'), 'utf8'));

export default createPinappAgent({
    name: '@pinapp-io/dives',
    title: 'Dives',
    template,
    templateDir,
    refinery: [LocationFromIp, Weather],
});
