import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/authConfig";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");

  const cookieStore = await cookies();
  const redirectTo = cookieStore.get("redirectTo")?.value || "/patient";

  if (!code) {
    return NextResponse.json(
      { error: "Authorization code is missing" },
      { status: 400 }
    );
  }

  // Step 1: Exchange code → Health ID Access Token
  const tokenResponse = await fetch("https://moph.id.th/api/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.HEALTH_REDIRECT_URI,
      client_id: process.env.HEALTH_CLIENT_ID,
      client_secret: process.env.HEALTH_CLIENT_SECRET,
    }),
  });
  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    return NextResponse.json(
      { error: tokenData.error || "Failed to fetch Health ID token" },
      { status: tokenResponse.status }
    );
  }

  // Step 2: Health ID token → Provider ID Access Token
  const providerTokenResponse = await fetch(
    "https://provider.id.th/api/v1/services/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.PROVIDER_CLIENT_ID,
        secret_key: process.env.PROVIDER_CLIENT_SECRET,
        token_by: "Health ID",
        token: tokenData.data.access_token,
      }),
    }
  );
  const providerTokenData = await providerTokenResponse.json();

  if (!providerTokenResponse.ok) {
    return NextResponse.json(
      { error: providerTokenData.error || "Failed to fetch provider token" },
      { status: providerTokenResponse.status }
    );
  }

  // Step 3: Provider ID token → User Profile
  const profileResponse = await fetch(
    "https://provider.id.th/api/v1/services/profile?position_type=1",
    {
      method: "GET",
      headers: {
        "client-id": process.env.PROVIDER_CLIENT_ID!,
        "secret-key": process.env.PROVIDER_CLIENT_SECRET!,
        Authorization: `Bearer ${providerTokenData.data.access_token}`,
      },
    }
  );
  const profileData = await profileResponse.json();

  if (!profileResponse.ok) {
    return NextResponse.json(
      { error: profileData.error || "Failed to fetch profile data" },
      { status: profileResponse.status }
    );
  }

  // Step 4: สร้าง Auth.js Session
  const res = await signIn("credentials", {
    "cred-way": "health-id",
    profile: JSON.stringify(profileData.data),
    redirectTo,
  });

  return res;
}
