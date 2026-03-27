import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getUploadSignature } from "@/lib/cloudinary";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const data = getUploadSignature();
  return NextResponse.json(data);
}
