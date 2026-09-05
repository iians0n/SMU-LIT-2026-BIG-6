import { api,requireCase } from '@/lib/server/session';
import { getWorkflow } from '@/lib/workflow';
export async function GET(request:Request){return api(request,()=>getWorkflow(requireCase(request)));}
