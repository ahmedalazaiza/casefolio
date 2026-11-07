import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, ownerAc } from "better-auth/plugins/organization/access";

export const organizationAccessControl = createAccessControl(defaultStatements);

export const ownerOrgRole = ownerAc;

export const adminOrgRole = organizationAccessControl.newRole({
  organization: [],
  member: ["delete"],
  invitation: ["create", "cancel"],
  team: [],
  ac: ["read"],
});

export const memberOrgRole = organizationAccessControl.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ["read"],
});

// Keep legacy aliases mapped to canonical equivalents so existing rows never fail role resolution
export const editorOrgRole = adminOrgRole;
export const viewerOrgRole = memberOrgRole;

export const organizationRoles = {
  owner: ownerOrgRole,
  admin: adminOrgRole,
  member: memberOrgRole,
  editor: editorOrgRole,
  viewer: viewerOrgRole,
} as const;

export type OrganizationRoleName = keyof typeof organizationRoles;
