#!/usr/bin/env node

/**
 * 从 @anthropic-ai/claude-code npm 包的 source map 中提取原始 TypeScript 源码
 *
 * 用法:
 *   1. npm pack @anthropic-ai/claude-code@2.1.88 --registry https://registry.npmjs.org
 *   2. tar -xzf anthropic-ai-claude-code-2.1.88.tgz
 *   3. node extract-sources.js ./package/cli.js.map ./output-dir
 */

const fs = require('fs');
const path = require('path');

const mapFile = process.argv[2] || 'package/cli.js.map';
const outputDir = process.argv[3] || 'extracted-src';

console.log(`Reading source map: ${mapFile}`);
const raw = fs.readFileSync(mapFile, 'utf8');
console.log(`Size: ${(raw.length / 1024 / 1024).toFixed(1)} MB`);

const map = JSON.parse(raw);
console.log(`Version: ${map.version}`);
console.log(`Sources: ${map.sources?.length || 0}`);
console.log(`SourcesContent: ${map.sourcesContent?.length || 0}`);

if (!map.sourcesContent || map.sourcesContent.length === 0) {
  console.error('No sourcesContent found.');
  process.exit(1);
}

let extracted = 0;
let skipped = 0;
let totalLines = 0;

for (let i = 0; i < map.sources.length; i++) {
  const sourcePath = map.sources[i];
  const content = map.sourcesContent[i];

  if (!content || content.trim() === '') { skipped++; continue; }
  if (sourcePath.includes('node_modules')) { skipped++; continue; }

  const cleanPath = sourcePath.replace(/^\.\.\//, '');
  const outPath = path.join(outputDir, cleanPath);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content, 'utf8');

  totalLines += content.split('\n').length;
  extracted++;
}

console.log(`\nDone!`);
console.log(`  Extracted: ${extracted} files`);
console.log(`  Skipped: ${skipped} (empty or node_modules)`);
console.log(`  Total lines: ${totalLines.toLocaleString()}`);
console.log(`  Output: ${outputDir}`);
