import { auth } from "@/authConfig";

export default auth((req) => {
  if (process.env.NODE_ENV === "development") return;
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/patient/:path*"],
};
