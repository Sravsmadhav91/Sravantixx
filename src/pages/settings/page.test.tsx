import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { listMigrationTeamMembersMock, listMigrationTeamRolesMock, getMigrationEmailSettingsMock, saveMigrationEmailSettingsMock, inviteMigrationTeamMemberMock, removeMigrationTeamMemberMock, updateMigrationTeamMemberRoleMock } = vi.hoisted(() => ({
  listMigrationTeamMembersMock: vi.fn(),
  listMigrationTeamRolesMock: vi.fn(),
  getMigrationEmailSettingsMock: vi.fn(),
  saveMigrationEmailSettingsMock: vi.fn(),
  inviteMigrationTeamMemberMock: vi.fn(),
  removeMigrationTeamMemberMock: vi.fn(),
  updateMigrationTeamMemberRoleMock: vi.fn(),
}));

vi.mock("@/lib/migration-api.ts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/migration-api.ts")>("@/lib/migration-api.ts");
  return {
    ...actual,
    migrationApiEnabled: true,
    listMigrationTeamMembers: listMigrationTeamMembersMock,
    listMigrationTeamRoles: listMigrationTeamRolesMock,
    getMigrationEmailSettings: getMigrationEmailSettingsMock,
    saveMigrationEmailSettings: saveMigrationEmailSettingsMock,
    inviteMigrationTeamMember: inviteMigrationTeamMemberMock,
    removeMigrationTeamMember: removeMigrationTeamMemberMock,
    updateMigrationTeamMemberRole: updateMigrationTeamMemberRoleMock,
  };
});

import SettingsPage from "./page";

describe("SettingsPage migration mode", () => {
  it("renders the live team and email configuration instead of the placeholder", async () => {
    listMigrationTeamMembersMock.mockResolvedValue([
      {
        _id: "member-1",
        ownerId: "owner-1",
        email: "asha@example.com",
        status: "active",
        invitedAt: "2025-01-01T00:00:00.000Z",
        role: "sales",
        memberName: "Asha",
      },
    ]);
    listMigrationTeamRolesMock.mockResolvedValue([
      { role: "staff", label: "Staff", description: "" },
      { role: "sales", label: "Sales", description: "" },
    ]);
    getMigrationEmailSettingsMock.mockResolvedValue({
      emailSenderName: "Sravantix Realty",
      emailSenderAddress: "collections@sravantix.com",
      emailReplyTo: "accounts@sravantix.com",
    });
    saveMigrationEmailSettingsMock.mockResolvedValue(undefined);

    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    expect(screen.getByText("Team members")).toBeInTheDocument();
    expect(screen.getByText("Email configuration")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Sender display name"), {
      target: { value: "New Realty" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save email settings" }));

    await waitFor(() => expect(saveMigrationEmailSettingsMock).toHaveBeenCalledWith({
      emailSenderName: "New Realty",
      emailSenderAddress: "collections@sravantix.com",
      emailReplyTo: "accounts@sravantix.com",
    }));
  });
});