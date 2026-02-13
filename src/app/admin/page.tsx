import { getChildren, getVideos, getSettings } from "@/src/lib/actions";
import AdminDashboard from "@/src/components/AdminDashboard";

export default async function AdminPage() {
    const [childrenList, videoList, settingsMap] = await Promise.all([
        getChildren(),
        getVideos(),
        getSettings(),
    ]);

    return (
        <AdminDashboard
            profiles={childrenList}
            videos={videoList}
            settings={settingsMap}
        />
    );
}
