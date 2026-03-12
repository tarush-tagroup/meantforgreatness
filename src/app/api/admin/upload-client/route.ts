import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSessionUser } from "@/lib/auth-guard";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

/**
 * Client upload token exchange route.
 *
 * The `upload()` function from `@vercel/blob/client` calls this endpoint
 * to obtain a short-lived token, then uploads the file directly to
 * Vercel Blob from the browser — bypassing the 4.5 MB serverless body limit.
 *
 * After the raw file is in Blob, the client calls `/api/admin/upload/process`
 * to optimise the image, extract EXIF, and save to the DB.
 */
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Authenticate — only registered users with upload permission
        const user = await getSessionUser();
        if (!user) throw new Error("Not authenticated");
        if (!hasPermission(user.roles, "media:upload")) {
          throw new Error("No upload permission");
        }

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
          ],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async () => {
        // Processing is handled by /api/admin/upload/process
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
