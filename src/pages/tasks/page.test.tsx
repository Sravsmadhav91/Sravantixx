import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/migration-api.ts", () => ({
  migrationApiEnabled: true,
}));

vi.mock("@/hooks/use-migration-tasks.ts", () => ({
  useMigrationTasks: () => ({
    tasks: [
      {
        _id: "task-1",
        ownerId: "owner-1",
        linkedType: "buyer",
        linkedId: "buyer-1",
        linkedName: "Jane Buyer",
        title: "Follow up on buyer documents",
        dueDate: "2025-01-01",
        priority: "high",
        status: "open",
        notes: "Need updated ID proof",
      },
    ],
    error: null,
  }),
}));

import TasksDashboardPage from "./page";

describe("TasksDashboardPage", () => {
  it("uses the migration task view when migration mode is enabled", () => {
    render(
      <MemoryRouter>
        <TasksDashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByText("Follow up on buyer documents")).toBeInTheDocument();
  });
});
