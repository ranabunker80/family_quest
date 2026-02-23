import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            // Check if user has a profile — if not, redirect to onboarding
            const { data: { user } } = await supabase.auth.getUser();
            let redirectPath = next;

            if (user) {
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("id")
                    .eq("id", user.id)
                    .single();

                if (!profile) {
                    redirectPath = "/onboarding";
                }
            }

            const forwardedHost = request.headers.get("x-forwarded-host");
            const isLocalEnv = process.env.NODE_ENV === "development";
            if (isLocalEnv) {
                return NextResponse.redirect(`${origin}${redirectPath}`);
            } else if (forwardedHost) {
                return NextResponse.redirect(`https://${forwardedHost}${redirectPath}`);
            } else {
                return NextResponse.redirect(`${origin}${redirectPath}`);
            }
        }
    }

    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
