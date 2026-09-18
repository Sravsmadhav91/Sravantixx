import { useEffect, useState } from "react";
import { getMigrationProject, migrationGet, type MigrationProject } from "@/lib/migration-api.ts";

export type MigrationConstructionStage = {
  _id: string;
  name: string;
  stageGroup?: string;
  category?: string;
  order: number;
  percentComplete: number;
  startDate?: string;
  targetDate?: string;
  completedDate?: string;
  plannedCost?: number;
  actualCost?: number;
  materialCost?: number;
  labourCost?: number;
  responsiblePerson?: string;
  vendor?: string;
  inspectionStatus?: string;
  approvalStatus?: string;
  documents?: string;
  attachment?: { fileName: string; contentType: string; size: number; dataBase64: string };
  notes?: string;
};

export type MigrationConstructionExpense = {
  _id: string;
  category: string;
  description: string;
  vendor?: string;
  amount: number;
  expenseDate: string;
  notes?: string;
};

export type MigrationConstruction = {
  project: MigrationProject;
  stages: MigrationConstructionStage[];
  expenses: MigrationConstructionExpense[];
  summary: {
    totalExpenses: number;
    overallProgress: number;
    stageCount: number;
    byCategory: Record<string, number>;
  };
};

export function useMigrationConstruction(projectId: string | undefined) {
  const [data, setData] = useState<MigrationConstruction | null | undefined>();
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let active = true;
    setData(undefined);
    setError(null);
    Promise.all([
      getMigrationProject(projectId),
      migrationGet<MigrationConstructionStage[]>(`/api/projects/${encodeURIComponent(projectId)}/construction/stages`),
      migrationGet<MigrationConstructionExpense[]>(`/api/projects/${encodeURIComponent(projectId)}/construction/expenses`),
    ])
      .then(([project, stages, expenses]) => {
        if (!active) return;
        const byCategory: Record<string, number> = {};
        for (const expense of expenses) byCategory[expense.category] = (byCategory[expense.category] ?? 0) + expense.amount;
        setData({
          project,
          stages,
          expenses,
          summary: {
            totalExpenses: expenses.reduce((total, expense) => total + expense.amount, 0),
            overallProgress: stages.length === 0 ? 0 : Math.round(stages.reduce((total, stage) => total + stage.percentComplete, 0) / stages.length),
            stageCount: stages.length,
            byCategory,
          },
        });
      })
      .catch((value: unknown) => {
        if (active) {
          setError(value instanceof Error ? value : new Error("Could not load construction"));
          setData(null);
        }
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  return { data, error };
}
