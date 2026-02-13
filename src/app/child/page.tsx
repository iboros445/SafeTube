import { getActiveSession } from "@/src/lib/auth";
import { getVideos } from "@/src/lib/actions";
import { redirect } from "next/navigation";
import ChildView from "@/src/components/ChildView";

export default async function ChildPage() {
    const sessionData = await getActiveSession();

    if (!sessionData) {
        redirect("/");
    }

    const videoList = await getVideos();

    return (
        <ChildView
            child={sessionData.child}
            videos={videoList}
        />
    );
}
