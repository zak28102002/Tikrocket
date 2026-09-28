import type { Role } from "@/generated/prisma/enums";

const RANK: Record<Role, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2 };

/** Viewer = read & export · Member = + create/refresh · Admin = + settings, members, delete. */
export const hasRole = (actual: Role, required: Role) => RANK[actual] >= RANK[required];
