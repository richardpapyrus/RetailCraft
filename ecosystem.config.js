module.exports = {
    apps: [
        {
            name: "pos-api",
            cwd: "./apps/api",
            script: "npm",
            args: "run start:dev",
            env: {
                DATABASE_URL: "postgresql://admin:password@localhost:5432/pos_db?schema=public",
                PORT: 4000
            },
            restart_delay: 3000
        },
        {
            name: "pos-web",
            cwd: "./apps/web",
            script: "npm",
            args: "run dev",
            env: {
                NEXT_PUBLIC_API_URL: "http://localhost:4000"
            },
            restart_delay: 3000
        }
    ]
};
