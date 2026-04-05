import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { signIn } from "@/authConfig";
import { profileHasActiveHoscode } from "@/lib/hospital-access";

function toDisplayName(profile: unknown) {
  if (!profile || typeof profile !== "object") return "";

  const record = profile as {
    title_th?: unknown;
    firstname_th?: unknown;
    lastname_th?: unknown;
    name_th?: unknown;
  };

  const fullName =
    [record.title_th, record.firstname_th, record.lastname_th]
      .filter((value): value is string => typeof value === "string" && value.trim() !== "")
      .join("") || (typeof record.name_th === "string" ? record.name_th : "");

  return fullName.trim();
}

function toDisplayOrganization(profile: unknown) {
  if (!profile || typeof profile !== "object") return { hcode: "", hname: "" };

  const record = profile as {
    hcode?: unknown;
    organizations?: unknown;
    organization?: unknown;
  };

  const directHcode = typeof record.hcode === "string" ? record.hcode.trim() : "";
  const rawOrganizations = Array.isArray(record.organizations)
    ? record.organizations
    : Array.isArray(record.organization)
      ? record.organization
      : [];

  for (const item of rawOrganizations) {
    try {
      const org = typeof item === "string" ? JSON.parse(item) : item;
      const hcode = typeof org?.hcode === "string" ? org.hcode.trim() : "";
      const hname = typeof org?.hname_th === "string" ? org.hname_th.trim() : "";
      if (hcode || hname) {
        return { hcode, hname };
      }
    } catch {
      // Ignore malformed organization entries.
    }
  }

  return { hcode: directHcode, hname: "" };
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");

  const cookieStore = await cookies();
  const redirectTo = cookieStore.get("redirectTo")?.value || "/patient";

  if (!code) {
    return NextResponse.json({ error: "Authorization code is missing" }, { status: 400 });
  }

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
      { status: tokenResponse.status },
    );
  }

  const providerTokenResponse = await fetch("https://provider.id.th/api/v1/services/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.PROVIDER_CLIENT_ID,
      secret_key: process.env.PROVIDER_CLIENT_SECRET,
      token_by: "Health ID",
      token: tokenData.data.access_token,
    }),
  });
  const providerTokenData = await providerTokenResponse.json();

  if (!providerTokenResponse.ok) {
    return NextResponse.json(
      { error: providerTokenData.error || "Failed to fetch provider token" },
      { status: providerTokenResponse.status },
    );
  }

  const profileResponse = await fetch("https://provider.id.th/api/v1/services/profile?position_type=1", {
    method: "GET",
    headers: {
      "client-id": process.env.PROVIDER_CLIENT_ID!,
      "secret-key": process.env.PROVIDER_CLIENT_SECRET!,
      Authorization: `Bearer ${providerTokenData.data.access_token}`,
    },
  });
  const profileData = await profileResponse.json();

  if (!profileResponse.ok) {
    return NextResponse.json(
      { error: profileData.error || "Failed to fetch profile data" },
      { status: profileResponse.status },
    );
  }

  if (!(await profileHasActiveHoscode(profileData.data))) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("error", "unauthorized_hcode");
    loginUrl.searchParams.set("displayName", toDisplayName(profileData.data));
    loginUrl.searchParams.set("providerId", String(profileData.data?.provider_id ?? profileData.data?.account_id ?? ""));
    const org = toDisplayOrganization(profileData.data);
    loginUrl.searchParams.set("hcode", org.hcode);
    loginUrl.searchParams.set("hname", org.hname);
    return NextResponse.redirect(loginUrl);
  }

  const res = await signIn("credentials", {
    "cred-way": "health-id",
    profile: JSON.stringify(profileData.data),
    redirectTo,
  });

  return res;
}
