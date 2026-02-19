import { db, dbReady } from "@/src/db";
import { children, sessions } from "@/src/db/schema";
import { eq, desc, and } from "drizzle-orm";
import type { Child, NewChild } from "@/src/db/schema";

export async function getChild(id: number): Promise<Child | undefined> {
    await dbReady;
    const [child] = await db.select().from(children).where(eq(children.id, id)).limit(1);
    return child;
}

export async function getAllChildren(): Promise<Child[]> {
    await dbReady;
    return db.select().from(children);
}

export async function createChild(data: NewChild): Promise<number> {
    await dbReady;
    await db.insert(children).values(data);
    // Get the ID of the newly created child
    const [newChild] = await db
        .select({ id: children.id })
        .from(children)
        .orderBy(desc(children.id))
        .limit(1);
    return newChild.id;
}

export async function updateChild(id: number, data: Partial<NewChild>): Promise<void> {
    await dbReady;
    await db.update(children).set(data).where(eq(children.id, id));
}

export async function deleteChild(id: number): Promise<void> {
    await dbReady;
    await db.delete(children).where(eq(children.id, id));
}

// Session helpers (since sessions are tightly coupled with children)
export async function endSessionForChild(childId: number): Promise<void> {
    await dbReady;
    await db.update(sessions)
        .set({ active: false })
        .where(and(eq(sessions.childId, childId), eq(sessions.active, true)));
}

export async function getChildSessions(childId: number) {
    await dbReady;
    return db
        .select()
        .from(sessions)
        .where(and(eq(sessions.childId, childId), eq(sessions.active, true)));
}


