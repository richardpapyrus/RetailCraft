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
                DATABASE_URL: "postgresql://doadmin:AVNS_iNZVQYj-RX036W3B0oS@retail-craft-db-postgres-do-user-24373738-0.k.db.ondigitalocean.com:25060/pos_db?sslmode=require"
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
                DATABASE_URL: "postgresql://doadmin:AVNS_iNZVQYj-RX036W3B0oS@retail-craft-db-postgres-do-user-24373738-0.k.db.ondigitalocean.com:25060/pos_db_staging?sslmode=require"
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
