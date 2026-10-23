const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DOCS_FILE = path.join(PROJECT_ROOT, 'docs', 'PROJECT_STRUCTURE.md');

const EXCLUDED = new Set(['node_modules', '.git', '.wrangler', 'dist', 'scripts']);

const ANNOTATIONS = {
  'planning': 'Project planning and roadmap (in docs/)',
  'ROADMAP.md': 'Phase-by-phase development plan',
  'STATE.md': 'Current project state and next actions (in docs/)',
  'd1': 'Cloudflare D1 database (NEW — Phase 2)',
  'schema.sql': 'SQLite schema for meme metadata',
  'docs': 'Dedicated project documentation folder',
  'CHANGELOG.md': 'Version history',
  'CLAUDE.md': 'Development setup & commands guide',
  'DATABASE.md': 'Database and storage architecture docs',
  'PROJECT_STRUCTURE.md': 'This file',
  'README.md': 'Project overview and setup guide',
  'functions': 'Cloudflare Pages Functions (serverless API)',
  '_shared': 'Shared utilities for all API routes',
  'd1r2.ts': 'D1 + R2 helper (NEW — replaces supabase.ts)',
  'fallbackMemes.ts': 'Static fallback memes for offline/empty DB',
  'pages.ts': 'Cloudflare Pages type definitions',
  'supabase.ts': 'OLD Supabase REST client (being replaced)',
  'api': 'API route handlers',
  'random-meme.ts': 'GET /api/random-meme — public',
  'daily-meme.ts': 'GET /api/daily-meme — public',
  'nsfw.ts': 'PATCH /api/curate/nsfw — Curator NSFW flag toggle',
  '013_add_nsfw_flag.sql': 'D1 migration 013: is_nsfw & nsfw_flagged_by columns',
  'admin': 'Admin dashboard',
  'memes.ts': 'GET/POST/PATCH/DELETE /api/admin/memes',
  'upload.ts': 'POST /api/admin/upload',
  'sync-r2.ts': 'POST /api/admin/sync-r2 (R2→D1 sync)',
  'public': 'Static assets served directly',
  '_headers': 'Cloudflare Pages custom headers',
  'icon.svg': 'PWA icon',
  'manifest.webmanifest': 'PWA manifest',
  'sw.js': 'Service worker for offline support',
  'src': 'Frontend source code',
  'App.tsx': 'Main app component — meme capsule UI',
  'main.tsx': 'React entry point and router',
  'styles.css': 'Global styles and animations',
  'types.ts': 'TypeScript type definitions (Meme, Rarity, etc.)',
  'vite-env.d.ts': 'Vite environment type augmentation',
  'AdminApp.tsx': 'Admin UI component',
  'admin.css': 'Admin-specific styles',
  'data': 'Static data',
  'lib': 'Utility modules',
  'adminApi.ts': 'Frontend → admin API client',
  'adminCollection.ts': 'Local admin collection (localStorage)',
  'localState.ts': 'Local device state (favorites, LOLs)',
  'memeApi.ts': 'Frontend → public meme API client',
  'share.ts': 'Share/save functionality',
  'supabase': 'OLD Supabase schema (being replaced by d1/)',
  'wrangler.toml': 'Cloudflare Workers/Pages config (NEW — Phase 2)',
  '.dev.vars.example': 'Environment variable template',
  '.gitignore': 'Git ignore rules',
  'index.html': 'HTML entry point',
  'package.json': 'Dependencies and scripts',
  'package-lock.json': 'Locked dependency tree',
  'tsconfig.json': 'TypeScript configuration',
  'vite.config.ts': 'Vite build configuration',
};

function getTreeString(dirPath, prefix = '') {
  let output = '';
  const items = fs.readdirSync(dirPath).filter(name => !EXCLUDED.has(name));
  
  // Sort: directories first, then files
  items.sort((a, b) => {
    const aStat = fs.statSync(path.join(dirPath, a));
    const bStat = fs.statSync(path.join(dirPath, b));
    if (aStat.isDirectory() && !bStat.isDirectory()) return -1;
    if (!aStat.isDirectory() && bStat.isDirectory()) return 1;
    return a.localeCompare(b);
  });

  items.forEach((item, index) => {
    const itemPath = path.join(dirPath, item);
    const isDir = fs.statSync(itemPath).isDirectory();
    const isLast = index === items.length - 1;
    const marker = isLast ? '└── ' : '├── ';
    
    // Annotation resolution
    const annotation = ANNOTATIONS[item] || '';
    const annotatedText = annotation ? `                    # ${annotation}` : '';
    
    // Construct line
    let line = `${prefix}${marker}${item}`;
    if (annotatedText) {
      const padLen = Math.max(34 - line.length, 1);
      line += ' '.repeat(padLen) + annotatedText;
    }
    
    output += line + '\n';
    
    if (isDir && !EXCLUDED.has(item)) {
      output += getTreeString(itemPath, prefix + (isLast ? '    ' : '│   '));
    }
  });
  
  return output;
}

try {
  console.log('Generating directory structure map...');
  const tree = 'meme application/\n' + getTreeString(PROJECT_ROOT);
  
  if (!fs.existsSync(DOCS_FILE)) {
    console.error(`PROJECT_STRUCTURE.md not found at ${DOCS_FILE}`);
    process.exit(1);
  }
  
  let content = fs.readFileSync(DOCS_FILE, 'utf8');
  
  const startTag = '<!-- DIRECTORY_MAP_START -->';
  const endTag = '<!-- DIRECTORY_MAP_END -->';
  
  const startIndex = content.indexOf(startTag);
  const endIndex = content.indexOf(endTag);
  
  if (startIndex === -1 || endIndex === -1) {
    console.error('Placeholder tags for directory map not found in PROJECT_STRUCTURE.md');
    process.exit(1);
  }
  
  const before = content.substring(0, startIndex + startTag.length);
  const after = content.substring(endIndex);
  const updatedContent = `${before}\n\`\`\`\n${tree}\`\`\`\n${after}`;
  
  fs.writeFileSync(DOCS_FILE, updatedContent, 'utf8');
  console.log('Successfully updated docs/PROJECT_STRUCTURE.md directory map!');
} catch (err) {
  console.error('Failed to sync project structure:', err);
  process.exit(1);
}
