import { Routes, Route } from "react-router-dom";
import { RequireRole } from "@/lib/auth/RequireRole";
import AdminShell from "./layout/AdminShell";
import DashboardPage from "./features/dashboard/DashboardPage";
import AdminLoginPage from "./auth/AdminLoginPage";
import AcademicSetupPage from "./features/academics/AcademicSetupPage";
import StudentsPage from "./features/students/StudentsPage";
import StaffPage from "./features/staff/StaffPage";
import TeacherAssignmentsPage from "./features/assignments/TeacherAssignmentsPage";
import MyRosterPage from "./features/roster/MyRosterPage";
import FeesPage from "./features/fees/FeesPage";
import PaymentsPage from "./features/fees/PaymentsPage";
import PayrollPage from "./features/payroll/PayrollPage";
import ExamTermsPage from "./features/academics/ExamTermsPage";
import MarkEntryPage from "./features/marks/MarkEntryPage";
import ResultsReviewPage from "./features/results/ResultsReviewPage";
import LinkRequestsQueue from "./features/parents/LinkRequestsQueue";
import ExpensesPage from "./features/expenses/ExpensesPage";
import ExportsPage from "./features/exports/ExportsPage";
import AuditLogPage from "./features/audit/AuditLogPage";

const AdminApp = () => (
  <Routes>
    <Route path="/login" element={<AdminLoginPage />} />
    <Route
      path="/*"
      element={
        <RequireRole roles={["principal", "accountant", "teacher"]} loginPath="/login">
          <AdminShell>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/academics" element={<AcademicSetupPage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/staff" element={<StaffPage />} />
              <Route path="/assignments" element={<TeacherAssignmentsPage />} />
              <Route path="/my-roster" element={<MyRosterPage />} />
              <Route path="/fees" element={<FeesPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/payroll" element={<PayrollPage />} />
              <Route path="/exam-terms" element={<ExamTermsPage />} />
              <Route path="/marks" element={<MarkEntryPage />} />
              <Route path="/results" element={<ResultsReviewPage />} />
              <Route path="/parent-requests" element={<LinkRequestsQueue />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/exports" element={<ExportsPage />} />
              <Route path="/audit-log" element={<AuditLogPage />} />
            </Routes>
          </AdminShell>
        </RequireRole>
      }
    />
  </Routes>
);

export default AdminApp;
