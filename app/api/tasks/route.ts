import { z } from 'zod';
import { api,requireCase,checkVersion,ApiError } from '@/lib/server/session';
import { getWorkflow,appendVerification,createTasks } from '@/lib/workflow';
import { assertions,validateAssertion } from '@/lib/retrieval';
export async function GET(request:Request){return api(request,()=>getWorkflow(requireCase(request)).tasks);}
export async function POST(request:Request){return api(request,async()=>{const c=requireCase(request);const b=z.object({version:z.number().int(),action:z.enum(['refresh','complete','reopen','choose']),id:z.string().optional(),option:z.enum(['gather','settlement','help','file']).optional()}).parse(await request.json());checkVersion(c,b.version);const w=getWorkflow(c);
 if(b.action==='refresh'){w.tasks=createTasks(c);}
 else if(b.action==='choose'){if(!b.option)throw new ApiError(400,'Choose a next step.');if(b.option==='file'&&(w.route.outcome!=='appears_supported'||w.route.sourceCaseVersion!==c.version))throw new ApiError(409,'Review a supported filing route before choosing preparation for filing.');w.option=b.option;}
 else {const task=w.tasks.find(t=>t.id===b.id);if(!task)throw new ApiError(404,'Task not found.');checkVersion(c,task.sourceCaseVersion);if(b.action==='complete'){if(!validateAssertion(assertions[task.assertionId]).ok)throw new ApiError(409,'The supporting source needs review.');if(task.dependencies.some(id=>!w.tasks.some(t=>t.id===id&&t.status==='Reviewed'&&t.sourceCaseVersion===c.version)))throw new ApiError(409,'Complete the prerequisite tasks first.');task.status='Reviewed';}else task.status='In progress';}
 appendVerification(c,{action:b.action==='choose'?'option_selected':'reviewed',description:b.action==='choose'?`User chose ${b.option}`:`Tasks: ${b.action} ${b.id??''}`,sourceCaseVersion:c.version,sourceRefs:[],aiDrafted:false});return {tasks:w.tasks,option:w.option};});}
