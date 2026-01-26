import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../prisma/migrations');

// Dangerous keywords that imply data loss
const DANGEROUS_PATTERNS = [
    /DROP TABLE/i,
    /TRUNCATE/i,
    /DELETE FROM/i,
    /ALTER TABLE .* DROP COLUMN/i,
    // We allow DROP INDEX as it's often necessary for optimization and doesn't lose row data
];

function main() {
    console.log('🛡️  Running Safety Check on latest migration...');

    if (!fs.existsSync(MIGRATIONS_DIR)) {
        console.error(`❌ Migrations directory not found at: ${MIGRATIONS_DIR}`);
        process.exit(1);
    }

    // 1. Get all migration directories
    const entries = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
    const migrationDirs = entries
        .filter(dirent => dirent.isDirectory() && dirent.name !== 'migration_lock.toml')
        .map(dirent => dirent.name)
        .sort(); // Lexical sort works for YYYYMMDD... timestamps

    if (migrationDirs.length === 0) {
        console.log('✅ No migrations found to check.');
        process.exit(0);
    }

    // 2. Get latest migration
    const latestMigration = migrationDirs[migrationDirs.length - 1];
    const migrationFile = path.join(MIGRATIONS_DIR, latestMigration, 'migration.sql');

    console.log(`🔎 Checking latest migration: ${latestMigration}`);

    if (!fs.existsSync(migrationFile)) {
        console.warn(`⚠️  No migration.sql found in ${latestMigration}. Skipping.`);
        process.exit(0);
    }

    // 3. Read and Scan
    const sql = fs.readFileSync(migrationFile, 'utf-8');
    const lines = sql.split('\n');
    let warnings = [];

    lines.forEach((line, index) => {
        // Ignore comments
        const cleanLine = line.split('--')[0].trim();
        if (!cleanLine) return;

        for (const pattern of DANGEROUS_PATTERNS) {
            if (pattern.test(cleanLine)) {
                warnings.push(`[Line ${index + 1}] Found destructive command: ${cleanLine}`);
            }
        }
    });

    // 4. Report Results
    if (warnings.length > 0) {
        console.error('\n' + '='.repeat(60));
        console.error('🛑 SAFETY CHECK FAILED: DESTRUCTIVE CHANGES DETECTED');
        console.error('='.repeat(60));
        warnings.forEach(w => console.error(`❌ ${w}`));
        console.error('='.repeat(60));
        console.error('This migration contains commands that can delete data.');
        console.error('Deployment has been STOPPED to prevent Data Loss.');
        console.error('Please review the migration file manually.');
        process.exit(1);
    } else {
        console.log('✅ Safety Check Passed: No destructive commands found.');
        process.exit(0);
    }
}

main();
