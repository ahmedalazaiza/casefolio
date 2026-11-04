import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, ownerAc } from "better-auth/plugins/organization/access";

export const organizationAccessControl = createAccessControl(defaultStatements);

export const ownerOrgRole = ownerAc;

export const editorOrgRole = organizationAccessControl.newRole({
  organization: [],
  member: [],
  invitation: ["create"],
  team: [],
  ac: ["read"],
});

export const viewerOrgRole = organizationAccessControl.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ["read"],
});

export const organizationRoles = {
  owner: ownerOrgRole,
  editor: editorOrgRole,
  viewer: viewerOrgRole,
} as const;

export type OrganizationRoleName = keyof typeof organizationRoles;

