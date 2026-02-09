module.exports = {
    apps: [
        {
            name: "pos-api-staging",
            cwd: "./apps/api",
            script: "node",
            args: "dist/src/main.js",
            env_staging: {
                NODE_ENV: "production",
                PORT: 4001,
                DATABASE_URL: "postgresql://doadmin:AVNS_iNZVQYj-RX036W3B0oS@retail-craft-db-postgres-do-user-24373738-0.k.db.ondigitalocean.com:25060/pos_db_staging?sslmode=require"
            },
            env_development: {
                NODE_ENV: "development",
                PORT: 4000,
                DATABASE_URL: "postgresql://admin:password@localhost:5432/pos_db?schema=public"
            }
        },
        {
            name: "pos-web-staging",
            cwd: "./apps/web",
            script: "npm",
            args: "run start",
            env_staging: {
                NODE_ENV: "production",
                PORT: 3001,
                NEXT_PUBLIC_API_URL: "https://staging.retailcraft.com.ng/api"
            },
            env_development: {
                NODE_ENV: "development",
                PORT: 3000,
                NEXT_PUBLIC_API_URL: "http://localhost:4000"
            }
        }
    ]
};
