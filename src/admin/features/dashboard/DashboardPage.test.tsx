import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { AppRole } from "@/lib/auth/useSession";

// Regression coverage for the dashboard role-visibility bug: "Fee collection
// by class" (and the other financial bits added alongside it) must render
// only for a verified `principal` role, resolved the same way the rest of
// the app resolves roles (useSession -> user_roles via RLS) — never a
// client-editable flag. This mocks that hook directly rather than faking a
// Supabase session, so the test exercises exactly the boundary the bug was
// in: what DashboardPage does with a given role list, regardless of how
// that list was obtained.

const mockUseSession = vi.fn();
vi.mock("@/lib/auth/useSession", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/useSession")>("@/lib/auth/useSession");
  return { ...actual, useSession: () => mockUseSession() };
});

// Supabase is mocked at the client-factory level so no real network call is
// ever made. `select()` returns an object that is both directly awaitable
// AND chainable with `.eq()`/`.order()` (recursively, so any combination —
// e.g. `.select().order()`, `.select().eq()` — resolves to the same value),
// covering every query shape DashboardPage actually uses.
function makeAwaitableResult(value: unknown): Promise<unknown> & { eq: () => unknown; order: () => unknown } {
  const promise = Promise.resolve(value);
  return Object.assign(promise, {
    eq: () => makeAwaitableResult(value),
    order: () => makeAwaitableResult(value),
  });
}

const TABLE_RESULTS: Record<string, unknown> = {
  academic_years: { data: [], error: null },
  students: { data: [], error: null },
  staff: { count: 0, error: null },
  admission_enquiries: { count: 0, error: null },
  fee_schedules: { data: [], error: null },
  expenses: { data: [], error: null },
};

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    from: (table: string) => ({
      select: () => makeAwaitableResult(TABLE_RESULTS[table] ?? { data: [], error: null }),
    }),
  }),
}));

import DashboardPage from "./DashboardPage";

function renderDashboard(roles: AppRole[], loading = false) {
  mockUseSession.mockReturnValue({ session: loading ? null : { user: { id: "u1" } }, roles, loading });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardPage role-based visibility", () => {
  it("shows the Fee collection status by class chart for principal", async () => {
    renderDashboard(["principal"]);
    await waitFor(() => expect(screen.getByText("Fee collection status by class")).toBeInTheDocument());
  });

  it("hides the Fee collection status by class chart for teacher", async () => {
    renderDashboard(["teacher"]);
    // Let the gated queries resolve, then assert the chart never appears.
    await waitFor(() => expect(screen.getByText("Active students")).toBeInTheDocument());
    expect(screen.queryByText("Fee collection status by class")).not.toBeInTheDocument();
  });

  it("hides the Fee collection status by class chart for accountant", async () => {
    renderDashboard(["accountant"]);
    await waitFor(() => expect(screen.getByText("Active students")).toBeInTheDocument());
    expect(screen.queryByText("Fee collection status by class")).not.toBeInTheDocument();
  });

  it("hides the Fee collection status by class chart while roles are still loading", async () => {
    renderDashboard(["principal"], true);
    await waitFor(() => expect(screen.getByText("Active students")).toBeInTheDocument());
    expect(screen.queryByText("Fee collection status by class")).not.toBeInTheDocument();
  });

  it("shows the financial expense shortcut for accountant but not teacher", async () => {
    const { unmount } = renderDashboard(["accountant"]);
    await waitFor(() => expect(screen.getByText("Daily Expenses")).toBeInTheDocument());
    unmount();

    renderDashboard(["teacher"]);
    await waitFor(() => expect(screen.getByText("Active students")).toBeInTheDocument());
    expect(screen.queryByText("Daily Expenses")).not.toBeInTheDocument();
  });

  it("keeps general academic info (Students by class) visible to teacher", async () => {
    renderDashboard(["teacher"]);
    await waitFor(() => expect(screen.getByText("Students by class")).toBeInTheDocument());
  });

  it("shows the Outstanding fees by class chart for principal but not teacher", async () => {
    const { unmount } = renderDashboard(["principal"]);
    await waitFor(() => expect(screen.getByText("Outstanding fees by class")).toBeInTheDocument());
    unmount();

    renderDashboard(["teacher"]);
    await waitFor(() => expect(screen.getByText("Active students")).toBeInTheDocument());
    expect(screen.queryByText("Outstanding fees by class")).not.toBeInTheDocument();
  });

  it("offers a bar/line/pie/doughnut chart-type switcher on the chart cards", async () => {
    renderDashboard(["principal"]);
    await waitFor(() => expect(screen.getByText("Students by class")).toBeInTheDocument());
    // Two ChartTypeSwitcher instances render for principal (Students by
    // class, Outstanding fees by class), each with its own 4 toggle
    // buttons — asserting "at least one of each" confirms the switcher is
    // present without coupling the test to exactly which chart it's on.
    expect(screen.getAllByRole("radio", { name: "Bar" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("radio", { name: "Line" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("radio", { name: "Pie" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("radio", { name: "Doughnut" }).length).toBeGreaterThan(0);
  });
});
