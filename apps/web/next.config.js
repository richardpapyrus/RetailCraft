/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async rewrites() {
        return [
            {
                source: '/help',
                destination: `${process.env.HELP_DESK_URL || 'http://127.0.0.1:3002'}/help`,
            },
            {
                source: '/help/:path*',
                destination: `${process.env.HELP_DESK_URL || 'http://127.0.0.1:3002'}/help/:path*`,
            },
        ]
    },
}

module.exports = nextConfig
