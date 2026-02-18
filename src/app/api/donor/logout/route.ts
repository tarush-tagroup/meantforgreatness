import { NextResponse } from "next/server";
import { clearDonorCookie } from "@/lib/donor-auth";

export async function POST() {
  await clearDonorCookie();
  return NextResponse.json({ success: true });
}
