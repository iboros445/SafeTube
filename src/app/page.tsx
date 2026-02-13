import { getActiveSession } from "@/src/lib/auth";
import { getChildren, getAdminTheme } from "@/src/lib/actions";
import { redirect } from "next/navigation";
import HomeClient from "@/src/components/HomeClient";
import { initDb } from "@/src/db";

export default async function HomePage() {
    // Ensure database is initialized on first request
    await initDb();

    // If there's an active session, redirect to child view
    const sessionData = await getActiveSession();
    if (sessionData) {
        redirect("/child");
    }

    const childrenList = await getChildren();
    const adminTheme = await getAdminTheme();

    return <HomeClient profiles={childrenList} adminTheme={adminTheme} />;
}
