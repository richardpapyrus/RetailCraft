const fs = require("fs");
const path = require("path");

// Secrets live in ./.env (git-ignored). Minimal KEY=VALUE parser so pm2 needs no extra dependency.
function loadEnv(file) {
    const out = {};
    if (!fs.existsSync(file)) {
        throw new Error(`Missing ${file} - copy .env.example to .env and fill in the values`);
    }
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!m) continue;
        out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
    }
    return out;
}
const env = { ...loadEnv(path.join(__dirname, ".env")), ...process.env };

module.exports = {
    apps: [
        {
            name: "pos-api-prod",
            cwd: "./apps/api",
            script: "node",
            args: "dist/src/main.js",
            env: {
                NODE_ENV: "production",
                PORT: 4000,
                // Max DB connections for this API process (apps/api/src/prisma/client.ts).
                // Prod + staging together must stay under the DO cluster's connection limit.
                DATABASE_POOL_SIZE: "10",
                DATABASE_URL: env.DATABASE_URL_PROD,
                JWT_SECRET: env.JWT_SECRET
            }
        },
        {
            name: "pos-web-prod",
            cwd: "./apps/web",
            script: "npm",
            args: "run start",
            env: {
                NODE_ENV: "production",
                PORT: 3000,
                NEXT_PUBLIC_API_URL: "https://app.retailcraft.com.ng/api"
            }
        },
        {
            name: "pos-api-staging",
            cwd: "./apps/api",
            script: "node",
            args: "dist/src/main.js",
            env: {
                NODE_ENV: "production",
                PORT: 4001,
                DATABASE_POOL_SIZE: "5",
                DATABASE_URL: env.DATABASE_URL_STAGING,
                JWT_SECRET: env.JWT_SECRET
            }
        },
        {
            name: "pos-web-staging",
            cwd: "./apps/web",
            script: "npm",
            args: "run start",
            env: {
                NODE_ENV: "production",
                PORT: 3001,
                NEXT_PUBLIC_API_URL: "https://staging.retailcraft.com.ng/api"
            }
        },
        {
            name: "pos-docs-prod",
            cwd: "./apps/docs",
            script: "npm",
            args: "run start",
            env: {
                NODE_ENV: "production",
                PORT: 4002
            }
        },
        {
            name: "pos-docs-staging",
            cwd: "./apps/docs",
            script: "npm",
            args: "run start:staging",
            env: {
                NODE_ENV: "production",
                PORT: 3002
            }
        }
    ]
};
