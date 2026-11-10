import { handleRequest } from "../../../lib/backend/api";

async function handler(request: Request, context: { params: Promise<{ resource?: string[] }> }) {
  const { resource = [] } = await context.params;
  return handleRequest(request, resource);
}

export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
