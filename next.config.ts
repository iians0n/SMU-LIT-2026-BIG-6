import type { NextConfig } from 'next';
const config: NextConfig = {
  // Both spawn or resolve files at runtime relative to their own package.
  // Bundled, tesseract.js looks for its worker at .next/worker-script/... which
  // does not exist, and the request hangs on a module it can never load -
  // passing tests the whole time, because tsx does not bundle. Keeping them
  // external lets normal node_modules resolution apply.
  serverExternalPackages: ['tesseract.js', 'pdfjs-dist'],

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
