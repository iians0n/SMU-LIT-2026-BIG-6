import { VerificationInputSchema } from '@/lib/dashboard/contracts';
import { api,requireCase,checkVersion,ApiError } from '@/lib/server/session';
import { appendVerification,verificationRecord } from '@/lib/workflow';
import { sourceValue } from '@/lib/drafting';
export async function GET(request:Request){return api(request,()=>verificationRecord(requireCase(request)));}
export async function POST(request:Request){return api(request,async()=>{const c=requireCase(request);const input=VerificationInputSchema.parse(await request.json());checkVersion(c,input.sourceCaseVersion);if(input.sourceRefs.some(ref=>sourceValue(c,ref)===null))throw new ApiError(422,'A verification reference does not resolve in this case.');return appendVerification(c,input);});}
