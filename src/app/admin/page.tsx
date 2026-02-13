import { getChildren, getVideos, getSettings } from "@/src/lib/actions";
import AdminDashboard from "@/src/components/AdminDashboard";
import { getAdminSession } from "@/src/lib/auth";

export default async function AdminPage() {
    const [childrenList, videoList, settingsMap, isAdmin] = await Promise.all([
        getChildren(),
        getVideos(),
        getSettings(),
        getAdminSession(),
    ]);

    return (
        <AdminDashboard
            profiles={childrenList}
            videos={videoList}
            settings={settingsMap}
            initialIsAdmin={isAdmin}
        />
    );
}
