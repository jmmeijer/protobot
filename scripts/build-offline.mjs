import { cp, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

await cp('node_modules/blockly/media', 'dist/blockly-media', {recursive:true});
const files = (await readdir('dist', {recursive:true, withFileTypes:true}))
  .filter(entry => entry.isFile() && entry.name !== 'sw.js')
  .map(entry => (entry.parentPath + '/' + entry.name).replace(/^dist\//, ''))
  .sort();
const template = await readFile('scripts/sw.template.js', 'utf8');
const hash = createHash('sha256').update(template);
for (const file of files) hash.update(file).update(await readFile('dist/' + file));
await writeFile('dist/sw.js', template
  .replace('__VERSION__', hash.digest('hex').slice(0,20))
  .replace('__FILES__', JSON.stringify(files)));
