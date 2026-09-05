import { getPolicies } from '@/lib/policies';
export const dynamic = 'force-static';
export function GET() { return Response.json({ version: 2, policies: getPolicies() }); }
