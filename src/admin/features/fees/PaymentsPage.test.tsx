import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Regression test for the "student search replaced the payment form" bug:
// after adding StudentSearchCombobox, the page briefly looked like it had
// lost the payment-recording UI entirely (it's just gated behind a
// selection, with no empty-state message explaining that). This exercises
// the real flow end to end — type a search, select a result, confirm the
// payment form actually appears — rather than only reading the code.

type AwaitableChain = Promise<unknown> & {
  eq: () => AwaitableChain;
  neq: () => AwaitableChain;
  or: () => AwaitableChain;
  order: () => AwaitableChain;
  limit: () => AwaitableChain;
};

function makeAwaitableResult(value: unknown): AwaitableChain {
  const promise = Promise.resolve(value);
  return Object.assign(promise, {
    eq: () => makeAwaitableResult(value),
    neq: () => makeAwaitableResult(value),
    or: () => makeAwaitableResult(value),
    order: () => makeAwaitableResult(value),
    limit: () => makeAwaitableResult(value),
  });
}

const STUDENT_RESULTS = [
  {
    id: "student-1",
    admission_no: "ADM2026-0001",
    full_name: "Asha Rao",
    sections: { name: "A", classes: { name: "Class 5" } },
  },
];

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    from: (table: string) => ({
      select: () => {
        if (table === "students") {
          return makeAwaitableResult({ data: STUDENT_RESULTS, error: null });
        }
        if (table === "fee_schedules") {
          return makeAwaitableResult({
            data: [
              {
                id: "fs-1",
                period_month: "2026-11",
                amount_due_minor: 500000,
                status: "pending",
                fee_structures: { name: "Tuition" },
              },
            ],
            error: null,
          });
        }
        if (table === "payments") {
          return makeAwaitableResult({ data: [], error: null });
        }
        return makeAwaitableResult({ data: [], error: null });
      },
    }),
    rpc: vi.fn(),
  }),
}));

import PaymentsPage from "./PaymentsPage";

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PaymentsPage />
    </QueryClientProvider>,
  );
}

describe("PaymentsPage — student search + payment form integration", () => {
  it("shows the search field and an empty-state message, with no payment form, before a student is selected", () => {
    renderPage();
    expect(screen.getByText("Search for a student to record a payment.")).toBeInTheDocument();
    expect(screen.queryByText("Outstanding dues")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /record payment/i })).not.toBeInTheDocument();
  });

  it("reveals the full payment form — outstanding dues, method, record button — once a student is selected via search", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("combobox"));
    const searchInput = await screen.findByPlaceholderText("Type a name or admission number...");
    fireEvent.change(searchInput, { target: { value: "Asha" } });

    const result = await screen.findByText("Asha Rao", {}, { timeout: 2000 });
    fireEvent.click(result);

    await waitFor(() => expect(screen.getByText("Outstanding dues")).toBeInTheDocument());
    expect(screen.getByText("Recent payments")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record payment/i })).toBeInTheDocument();
    expect(screen.queryByText("Search for a student to record a payment.")).not.toBeInTheDocument();
  });
});
