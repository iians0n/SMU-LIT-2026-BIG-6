import { sources } from '@/lib/retrieval';
export async function GET(){return Response.json(sources,{headers:{'Cache-Control':'no-store'}});}
