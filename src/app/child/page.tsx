import { getActiveSession } from "@/src/lib/auth";
import { getVideos, getVideoProgressMap } from "@/src/lib/actions";
import { redirect } from "next/navigation";
import ChildView from "@/src/components/ChildView";

export default async function ChildPage() {
    const sessionData = await getActiveSession();

    if (!sessionData) {
        redirect("/");
    }

    const [videoList, progressMap] = await Promise.all([
        getVideos(),
        getVideoProgressMap(sessionData.child.id),
    ]);

    return (
        <ChildView
            child={sessionData.child}
            videos={videoList}
            progressMap={progressMap}
            initialLocked={sessionData.child.currentUsageSeconds >= sessionData.child.dailyLimitSeconds}
        />
    );
}
