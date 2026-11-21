import fs from "node:fs";
import path from "node:path";

interface Violation {
  file: string;
  line: number;
  snippet: string;
  rule: string;
}

const VIOLATIONS: Violation[] = [];

// Directories to check
const FUNCTIONS_DIR = path.resolve(process.cwd(), "functions");

// Allowed files for specific writes
const ALLOWED_CORPUS_WRITERS = new Set([
  path.resolve(FUNCTIONS_DIR, "_shared", "corpus.ts")
]);

const ALLOWED_MEME_INSERTERS = new Set([
  path.resolve(FUNCTIONS_DIR, "_shared", "intake.ts")
]);

// Patterns that write state
const PATTERNS = [
  {
    regex: /UPDATE\s+memes\s+SET[^;]*(corpus_status|is_active|status)\s*=/i,
    rule: "Direct update of memes.status, memes.is_active or memes.corpus_status is only permitted in functions/_shared/corpus.ts",
    allowed: ALLOWED_CORPUS_WRITERS
  },
  {
    regex: /INSERT\s+INTO\s+meme_curation_final/i,
    rule: "Writing to meme_curation_final is only permitted in functions/_shared/corpus.ts",
    allowed: ALLOWED_CORPUS_WRITERS
  },
  {
    regex: /UPDATE\s+meme_curation_final\s+SET/i,
    rule: "Writing to meme_curation_final is only permitted in functions/_shared/corpus.ts",
    allowed: ALLOWED_CORPUS_WRITERS
  },
  {
    regex: /INSERT\s+INTO\s+memes/i,
    rule: "INSERT INTO memes is only permitted in functions/_shared/intake.ts",
    allowed: ALLOWED_MEME_INSERTERS
  }
];

function scanDirectory(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
      checkFile(fullPath);
    }
  }
}

function checkFile(filePath: string) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check single-line or multi-line contexts if needed
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        if (!pattern.allowed.has(path.resolve(filePath))) {
          VIOLATIONS.push({
            file: path.relative(process.cwd(), filePath),
            line: i + 1,
            snippet: line.trim(),
            rule: pattern.rule
          });
        }
      }
    }
  }
}

console.log("🔍 Scanning functions/ for unauthorized state writers and meme inserts...");
scanDirectory(FUNCTIONS_DIR);

if (VIOLATIONS.length > 0) {
  console.error(`\n❌ Found ${VIOLATIONS.length} unauthorized state write(s):`);
  for (const v of VIOLATIONS) {
    console.error(`  - ${v.file}:${v.line} -> ${v.rule}\n    Snippet: "${v.snippet}"`);
  }
  process.exit(1);
} else {
  console.log("✅ Zero unauthorized state writers found. Single state writer invariant satisfied!");
  process.exit(0);
}
