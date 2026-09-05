import type { NextConfig } from 'next';
const config: NextConfig = {
  async rewrites() {
    // Fallback only: Anson's concrete routes take precedence without changing consumers.
    return { beforeFiles: [], afterFiles: [], fallback: [
      { source: '/api/case', destination: '/api/demo/case' },
      { source: '/api/case/:path*', destination: '/api/demo/case/:path*' },
      ...['intake','documents','chronology','evidence'].map(stage => ({source:`/${stage}`, destination:`/integration?stage=${stage}`})),
    ] };
  },
};
export default config;
