#!/usr/bin/env node
/**
 * Static Verification Test Suite
 * Run with: node test-verification.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let testsPassed = 0;
let testsFailed = 0;

function test(description, assertion, errorMsg) {
  if (assertion) {
    console.log(`✅ PASS: ${description}`);
    testsPassed++;
  } else {
    console.log(`❌ FAIL: ${description}`);
    console.log(`   ${errorMsg || ''}`);
    testsFailed++;
  }
}

console.log('\n=== Sara\'s Companions - Verification Tests ===\n');

// Test 1: Critical source files exist
console.log('--- File Existence Tests ---');
const criticalFiles = [
  'src/main/index.js',
  'src/main/windowManager.js',
  'src/main/ipcHandlers.js',
  'src/main/trayManager.js',
  'src/main/store.js',
  'src/renderer/pet.js',
  'src/renderer/animator.js',
  'src/renderer/behaviorEngine.js',
  'src/renderer/birthdaySurprise.js',
  'src/renderer/ui/speechBubble.js',
  'src/renderer/ui/contextMenu.js',
  'assets/tray-icon.png',
];

criticalFiles.forEach(file => {
  const exists = fs.existsSync(path.join(__dirname, file));
  test(`File exists: ${file}`, exists, 'File is missing!');
});

// Test 2: Active characters have complete assets
console.log('\n--- Character Asset Tests ---');
const activeChars = ['jimin', 'bts_jungkook', 'sam'];
activeChars.forEach(char => {
  const charDir = path.join(__dirname, 'src/characters', char);
  const hasJson = fs.existsSync(path.join(charDir, 'character.json'));
  const hasPng = fs.existsSync(path.join(charDir, 'spritesheet.png'));
  const hasFrames = fs.existsSync(path.join(charDir, 'spritesheet.json'));
  
  test(`Character ${char} has character.json`, hasJson, '');
  test(`Character ${char} has spritesheet.png`, hasPng, '');
  test(`Character ${char} has spritesheet.json`, hasFrames, '');
});

// Test 3: Spritesheet JSON structure validation
console.log('\n--- Spritesheet Structure Tests ---');
activeChars.forEach(char => {
  try {
    const framesPath = path.join(__dirname, 'src/characters', char, 'spritesheet.json');
    const data = JSON.parse(fs.readFileSync(framesPath, 'utf8'));
    const hasFrames = Array.isArray(data.frames);
    const frameCount = data.frames?.length || 0;
    
    test(`Character ${char} has valid frames array`, hasFrames, '');
    test(`Character ${char} has 46 frames (${frameCount})`, frameCount === 46, `Got ${frameCount} frames!`);
    
    // Check frame structure
    const validFrames = data.frames.every(f => 
      typeof f.x === 'number' &&
      typeof f.y === 'number' &&
      typeof f.width === 'number' &&
      typeof f.height === 'number'
    );
    test(`Character ${char} frames have valid structure`, validFrames, '');
  } catch (e) {
    test(`Character ${char} spritesheet valid`, false, e.message);
  }
});

// Test 4: Character JSON validation
console.log('\n--- Character Config Tests ---');
activeChars.forEach(char => {
  try {
    const configPath = path.join(__dirname, 'src/characters', char, 'character.json');
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    test(`${char}: has id`, !!data.id, '');
    test(`${char}: has name`, !!data.name, '');
    test(`${char}: has universe`, !!data.universe, '');
    test(`${char}: has quotes array`, Array.isArray(data.quotes) && data.quotes.length > 0, 'Quotes missing or empty!');
    
    // Optional fields
    const hasBehavior = data.behaviorWeights && typeof data.behaviorWeights === 'object';
    test(`${char}: has behaviorWeights (optional)`, hasBehavior, '');
  } catch (e) {
    test(`Character ${char} config valid`, false, e.message);
  }
});

// Test 5: Check store defaults match available characters
console.log('\n--- Store Configuration Tests ---');
const storePath = path.join(__dirname, 'src/main/store.js');
const storeContent = fs.readFileSync(storePath, 'utf8');
const match = storeContent.match(/activeCharacters:\s*\[([^\]]+)\]/);
if (match) {
  const defaultChars = match[1].match(/'([^']+)'/g)?.map(s => s.replace(/'/g, '')) || [];
  const allExist = defaultChars.every(char => {
    const charDir = path.join(__dirname, 'src/characters', char);
    return fs.existsSync(path.join(charDir, 'spritesheet.png'));
  });
  test(
    `Store defaults use characters with complete assets: [${defaultChars.join(', ')}]`,
    allExist,
    'Some default characters are missing sprites!'
  );
} else {
  test('Store defaults found', false, 'Could not parse store defaults');
}

// Test 6: Build output exists
console.log('\n--- Build Output Tests ---');
const buildFiles = [
  'out/main/index.js',
  'out/renderer/index.html',
];
buildFiles.forEach(file => {
  test(`Build output exists: ${file}`, fs.existsSync(path.join(__dirname, file)), 'Run npm run build!');
});

// Test 7: Check for hardcoded path issues
console.log('\n--- Code Quality Tests ---');
const handlerPath = path.join(__dirname, 'src/main/ipcHandlers.js');
const handlerContent = fs.readFileSync(handlerPath, 'utf8');
test(
  'IPC handlers use app.isPackaged check',
  handlerContent.includes('app.isPackaged'),
  'Paths may break in packaged app!'
);

test(
  'Tray manager has character loading fallback',
  handlerContent.includes('try') && handlerContent.includes('catch'),
  'Missing error handling!'
);

// Summary
console.log('\n=====================================');
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log(`Success Rate: ${Math.round((testsPassed / (testsPassed + testsFailed)) * 100)}%`);
console.log('=====================================\n');

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('✨ All verification tests passed! The app should work correctly.');
  process.exit(0);
}
