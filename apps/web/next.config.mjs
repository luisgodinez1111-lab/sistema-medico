/** @type {import('next').NextConfig} */
// EPIC B — `postgres` (postgres.js) es una dependencia nativa de servidor: se externaliza
// para que Next no intente empaquetarla en el bundle de la Function.
const nextConfig={
 serverExternalPackages:["postgres"],
};
export default nextConfig;
