import type { Metadata, Viewport } from 'next';
import './globals.css';
import { CaseProvider } from '@/components/case-provider';
import { Shell } from '@/components/shell';

export const metadata:Metadata={title:'Casepath · Small claims preparation',description:'A source-linked preparation workspace for self-represented court users.'};
export const viewport:Viewport={themeColor:'#f5f5f7'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><CaseProvider><Shell>{children}</Shell></CaseProvider></body></html>}
