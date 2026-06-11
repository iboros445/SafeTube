import { getChildren, getVideos, getSettings } from "@/src/lib/actions";
import AdminDashboard from "@/src/components/AdminDashboard";
import { getAdminSession } from "@/src/lib/auth";

export default async function AdminPage() {
    const isAdmin = await getAdminSession();

    if (!isAdmin) {
        return (
            <AdminDashboard
                profiles={[]}
                videos={[]}
                settings={{}}
                initialIsAdmin={false}
            />
        );
    }

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
            initialIsAdmin={true}
        />
    );
}
