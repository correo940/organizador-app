/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: false,
    },
    eslint: {
        ignoreDuringBuilds: false,
    },
    // Solo activar exportación estática si estamos construyendo para Capacitor
    output: process.env.STATIC_EXPORT === 'true' ? 'export' : undefined,
    distDir: process.env.STATIC_EXPORT === 'true' ? 'out' : '.next',
    skipTrailingSlashRedirect: true,
    // Para static export, necesitamos configurar qué rutas NO se deben pre-renderizar
    ...(process.env.STATIC_EXPORT === 'true' ? {
        experimental: {
            missingSuspenseWithCSRBailout: false,
            serverComponentsExternalPackages: ['pdf-parse'],
        },
    } : {
        experimental: {
            serverComponentsExternalPackages: ['pdf-parse'],
        },
    }),
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'placehold.co',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'picsum.photos',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'api.dicebear.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'raw.githubusercontent.com',
                port: '',
                pathname: '/**',
            },
            {
                protocol: 'https',
                hostname: 'avatars.githubusercontent.com',
                port: '',
                pathname: '/**',
            },
        ],
    },
};

const nextConfigWithHeaders = {
    ...nextConfig,
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                    { key: 'Pragma', value: 'no-cache' },
                    { key: 'Expires', value: '0' },
                ],
            },
        ];
    },
};

export default nextConfigWithHeaders;
