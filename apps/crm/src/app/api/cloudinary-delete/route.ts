import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cloudinary } from "@/lib/cloudinary";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { publicId } = await request.json();
  if (!publicId) {
    return NextResponse.json({ error: "publicId lipseste" }, { status: 400 });
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    return NextResponse.json(
      { error: "Eroare la stergerea imaginii" },
      { status: 500 }
    );
  }
}
