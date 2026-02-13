import { getActiveSession } from "@/src/lib/auth";
import { getChildren } from "@/src/lib/actions";
import { redirect } from "next/navigation";
import HomeClient from "@/src/components/HomeClient";

export default async function HomePage() {
    // If there's an active session, redirect to child view
    const sessionData = await getActiveSession();
    if (sessionData) {
        redirect("/child");
    }

    const childrenList = await getChildren();

    return <HomeClient profiles={childrenList} />;
}
